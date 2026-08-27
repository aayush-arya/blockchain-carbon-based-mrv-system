'use strict';

const { Contract } = require('fabric-contract-api');

const ECOSYSTEM_TYPES = ['mangrove', 'seagrass', 'salt_marsh'];
const MRV_STATUSES = ['PENDING_VALIDATION', 'VERIFIED', 'REJECTED', 'TOKENIZED'];
const CONFIG_KEY = 'CONFIG';

function mrvKey(mrvId) {
  return `MRV_${mrvId}`;
}
function evidenceHashKey(evidenceHash) {
  return `EVIDENCEHASH_${evidenceHash}`;
}
function tokenKey(assetId) {
  return `TOKEN_${assetId}`;
}
function tokenForMrvKey(mrvId) {
  return `TOKENFOR_${mrvId}`;
}

/** google.protobuf.Timestamp's `seconds` field comes through fabric-shim as a protobuf Long in
 * some call paths (getTxTimestamp - object with .low/.high) and a plain number/string in others
 * (getHistoryForKey's KeyModification.timestamp) - normalize both rather than assuming one shape. */
function secondsToNumber(seconds) {
  if (typeof seconds === 'number') return seconds;
  if (typeof seconds === 'object' && seconds !== null) {
    if (typeof seconds.toNumber === 'function') return seconds.toNumber();
    if (typeof seconds.low === 'number') return seconds.low;
  }
  return Number(seconds);
}

function timestampToIso(ts) {
  const millis = secondsToNumber(ts.seconds) * 1000 + Math.floor((ts.nanos || 0) / 1e6);
  return new Date(millis).toISOString();
}

/** Deterministic "now" - ctx.stub.getTxTimestamp() is assigned by the ordering service and is
 * identical across every endorsing peer. Using Date.now() in chaincode is a classic Fabric bug:
 * each peer would compute a different value and endorsements would never match. */
function txTimestampIso(ctx) {
  return timestampToIso(ctx.stub.getTxTimestamp());
}

async function getState(ctx, key) {
  const bytes = await ctx.stub.getState(key);
  if (!bytes || bytes.length === 0) return null;
  return JSON.parse(bytes.toString('utf8'));
}

async function putState(ctx, key, value) {
  await ctx.stub.putState(key, Buffer.from(JSON.stringify(value)));
}

async function getConfig(ctx) {
  const config = await getState(ctx, CONFIG_KEY);
  return config ?? { minConfidenceThreshold: 0 };
}

class MrvContract extends Contract {
  async InitLedger(ctx) {
    const existing = await getState(ctx, CONFIG_KEY);
    if (existing) return;
    await putState(ctx, CONFIG_KEY, { docType: 'config', minConfidenceThreshold: 0.3 });
  }

  async SetValidationConfig(ctx, minConfidenceThreshold) {
    const value = Number(minConfidenceThreshold);
    if (Number.isNaN(value) || value < 0 || value > 1) {
      throw new Error('minConfidenceThreshold must be a number between 0 and 1');
    }
    await putState(ctx, CONFIG_KEY, { docType: 'config', minConfidenceThreshold: value });
  }

  async GetValidationConfig(ctx) {
    return JSON.stringify(await getConfig(ctx));
  }

  /**
   * Records an off-chain-validated MRV submission on-chain for the first time. By this point
   * application-level validation (AI analysis, carbon calculation, off-chain duplicate
   * screening) has already happened in the backend - this is the point where the record
   * becomes part of the permanent, tamper-evident ledger, starting in PENDING_VALIDATION so a
   * validator's on-chain decision (ValidateMRVRecord/RejectMRVRecord) is itself part of the
   * immutable history, not just the final outcome.
   */
  async CreateMRVRecord(
    ctx,
    mrvId,
    mrvCode,
    contributorOrg,
    ecosystemType,
    latitude,
    longitude,
    capturedAt,
    areaM2,
    estimatedCarbonTco2e,
    aiConfidence,
    evidenceHash,
    metadataHash
  ) {
    if (!mrvId || !mrvCode || !contributorOrg || !evidenceHash || !metadataHash) {
      throw new Error('mrvId, mrvCode, contributorOrg, evidenceHash and metadataHash are all required');
    }
    if (!ECOSYSTEM_TYPES.includes(ecosystemType)) {
      throw new Error(`ecosystemType must be one of ${ECOSYSTEM_TYPES.join(', ')}`);
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) throw new Error('latitude must be between -90 and 90');
    if (Number.isNaN(lng) || lng < -180 || lng > 180) throw new Error('longitude must be between -180 and 180');

    const confidence = Number(aiConfidence);
    if (Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
      throw new Error('aiConfidence must be between 0 and 1');
    }
    const config = await getConfig(ctx);
    if (confidence < config.minConfidenceThreshold) {
      throw new Error(
        `aiConfidence ${confidence} is below the configured minimum ${config.minConfidenceThreshold}`
      );
    }

    if (await getState(ctx, mrvKey(mrvId))) {
      throw new Error(`MRV record ${mrvId} already exists on-chain`);
    }

    // Duplicate guard, independent of the backend's own check: refuse to record the same
    // evidence hash twice. A composite/plain key lookup (not a CouchDB rich query) so this
    // stays deterministic across endorsing peers regardless of state database.
    const existingForHash = await getState(ctx, evidenceHashKey(evidenceHash));
    if (existingForHash) {
      throw new Error(
        `Evidence hash ${evidenceHash} is already recorded on-chain for MRV record ${existingForHash.mrvId}`
      );
    }

    const now = txTimestampIso(ctx);
    const record = {
      docType: 'mrvRecord',
      mrvId,
      mrvCode,
      contributorOrg,
      ecosystemType,
      latitude: lat,
      longitude: lng,
      capturedAt,
      areaM2: Number(areaM2),
      estimatedCarbonTco2e: Number(estimatedCarbonTco2e),
      aiConfidence: confidence,
      evidenceHash,
      metadataHash,
      status: 'PENDING_VALIDATION',
      tokenAssetId: null,
      createdAt: now,
      updatedAt: now,
    };

    await putState(ctx, mrvKey(mrvId), record);
    await putState(ctx, evidenceHashKey(evidenceHash), { mrvId });
    ctx.stub.setEvent('MRVRecordCreated', Buffer.from(JSON.stringify({ mrvId, evidenceHash })));
    return JSON.stringify(record);
  }

  async ReadMRVRecord(ctx, mrvId) {
    const record = await getState(ctx, mrvKey(mrvId));
    if (!record) throw new Error(`MRV record ${mrvId} does not exist on-chain`);
    return JSON.stringify(record);
  }

  async MRVRecordExists(ctx, mrvId) {
    const record = await getState(ctx, mrvKey(mrvId));
    return record !== null;
  }

  /** Pure guard (no state write) shared by every function that transitions status, so there is
   * exactly one place the allowed-transition whitelist lives. */
  _assertTransitionAllowed(mrvId, currentStatus, newStatus) {
    const allowedTransitions = {
      PENDING_VALIDATION: ['VERIFIED', 'REJECTED'],
      VERIFIED: ['TOKENIZED'],
    };
    const allowedNext = allowedTransitions[currentStatus] || [];
    if (!MRV_STATUSES.includes(newStatus) || !allowedNext.includes(newStatus)) {
      throw new Error(`Cannot transition MRV record ${mrvId} from ${currentStatus} to ${newStatus}`);
    }
  }

  /** Generic transition entry point - enforces the exact same whitelist as
   * ValidateMRVRecord/RejectMRVRecord/IssueCarbonToken (which call the guard above directly
   * rather than through here, so each performs exactly one ledger write instead of two). */
  async UpdateMRVStatus(ctx, mrvId, newStatus) {
    const record = await getState(ctx, mrvKey(mrvId));
    if (!record) throw new Error(`MRV record ${mrvId} does not exist on-chain`);

    this._assertTransitionAllowed(mrvId, record.status, newStatus);
    record.status = newStatus;
    record.updatedAt = txTimestampIso(ctx);
    await putState(ctx, mrvKey(mrvId), record);
    return record;
  }

  async ValidateMRVRecord(ctx, mrvId, validatorId, reason) {
    const record = await getState(ctx, mrvKey(mrvId));
    if (!record) throw new Error(`MRV record ${mrvId} does not exist on-chain`);
    this._assertTransitionAllowed(mrvId, record.status, 'VERIFIED');

    record.status = 'VERIFIED';
    record.validatorId = validatorId;
    record.validationReason = reason || '';
    record.updatedAt = txTimestampIso(ctx);
    await putState(ctx, mrvKey(mrvId), record);

    ctx.stub.setEvent('MRVRecordValidated', Buffer.from(JSON.stringify({ mrvId, validatorId })));
    return JSON.stringify(record);
  }

  async RejectMRVRecord(ctx, mrvId, validatorId, reason) {
    if (!reason) throw new Error('A rejection reason is required');
    const record = await getState(ctx, mrvKey(mrvId));
    if (!record) throw new Error(`MRV record ${mrvId} does not exist on-chain`);
    this._assertTransitionAllowed(mrvId, record.status, 'REJECTED');

    record.status = 'REJECTED';
    record.validatorId = validatorId;
    record.rejectionReason = reason;
    record.updatedAt = txTimestampIso(ctx);
    await putState(ctx, mrvKey(mrvId), record);

    ctx.stub.setEvent('MRVRecordRejected', Buffer.from(JSON.stringify({ mrvId, validatorId, reason })));
    return JSON.stringify(record);
  }

  /** Only a VERIFIED record can be tokenized, and only once - enforced by the status
   * transition guard (VERIFIED -> TOKENIZED only) plus an explicit check that no token has
   * already been issued for this MRV record, so a retried/duplicate call can't mint twice. */
  async IssueCarbonToken(ctx, mrvId, assetId, ownerOrg) {
    if (!assetId || !ownerOrg) throw new Error('assetId and ownerOrg are required');

    const existingTokenForMrv = await getState(ctx, tokenForMrvKey(mrvId));
    if (existingTokenForMrv) {
      throw new Error(`MRV record ${mrvId} already has a token: ${existingTokenForMrv.assetId}`);
    }
    if (await getState(ctx, tokenKey(assetId))) {
      throw new Error(`Asset id ${assetId} already exists on-chain`);
    }

    const record = await getState(ctx, mrvKey(mrvId));
    if (!record) throw new Error(`MRV record ${mrvId} does not exist on-chain`);
    this._assertTransitionAllowed(mrvId, record.status, 'TOKENIZED');

    record.status = 'TOKENIZED';
    record.tokenAssetId = assetId;
    record.updatedAt = txTimestampIso(ctx);
    await putState(ctx, mrvKey(mrvId), record);

    const now = txTimestampIso(ctx);
    const token = {
      docType: 'carbonToken',
      assetId,
      mrvId,
      ecosystemType: record.ecosystemType,
      estimatedCarbonTco2e: record.estimatedCarbonTco2e,
      ownerOrg,
      issuedAt: now,
    };
    await putState(ctx, tokenKey(assetId), token);
    await putState(ctx, tokenForMrvKey(mrvId), { assetId });

    ctx.stub.setEvent('CarbonTokenIssued', Buffer.from(JSON.stringify({ mrvId, assetId })));
    return JSON.stringify(token);
  }

  async ReadCarbonToken(ctx, assetId) {
    const token = await getState(ctx, tokenKey(assetId));
    if (!token) throw new Error(`Carbon token ${assetId} does not exist on-chain`);
    return JSON.stringify(token);
  }

  async VerifyEvidenceHash(ctx, evidenceHash) {
    const entry = await getState(ctx, evidenceHashKey(evidenceHash));
    return JSON.stringify({ exists: entry !== null, mrvId: entry ? entry.mrvId : null });
  }

  /** Full mutation history of one MRV record's ledger key - a real Fabric feature (not a
   * simulation), returning every write with its transaction id and commit timestamp. */
  async GetTransactionHistory(ctx, mrvId) {
    const iterator = await ctx.stub.getHistoryForKey(mrvKey(mrvId));
    const history = [];
    let result = await iterator.next();
    while (!result.done) {
      const tx = result.value;
      history.push({
        txId: tx.txId,
        timestamp: timestampToIso(tx.timestamp),
        isDelete: tx.isDelete,
        value: tx.value.length > 0 ? JSON.parse(tx.value.toString('utf8')) : null,
      });
      result = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify(history);
  }

  async _queryBySelector(ctx, selector) {
    const iterator = await ctx.stub.getQueryResult(JSON.stringify({ selector }));
    const results = [];
    let result = await iterator.next();
    while (!result.done) {
      results.push(JSON.parse(result.value.value.toString('utf8')));
      result = await iterator.next();
    }
    await iterator.close();
    return results;
  }

  async QueryMRVRecords(ctx) {
    return JSON.stringify(await this._queryBySelector(ctx, { docType: 'mrvRecord' }));
  }

  async QueryByEcosystem(ctx, ecosystemType) {
    return JSON.stringify(await this._queryBySelector(ctx, { docType: 'mrvRecord', ecosystemType }));
  }

  async QueryByContributor(ctx, contributorOrg) {
    return JSON.stringify(await this._queryBySelector(ctx, { docType: 'mrvRecord', contributorOrg }));
  }

  async QueryByStatus(ctx, status) {
    return JSON.stringify(await this._queryBySelector(ctx, { docType: 'mrvRecord', status }));
  }
}

module.exports = MrvContract;
