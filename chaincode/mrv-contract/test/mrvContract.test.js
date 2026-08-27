'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { expect } = chai;

const MrvContract = require('../lib/mrvContract');
const { FakeContext } = require('./fakeContext');

function makeArgs(overrides = {}) {
  return {
    mrvId: 'mrv-1',
    mrvCode: 'MRV-000001',
    contributorOrg: 'Org1MSP',
    ecosystemType: 'mangrove',
    latitude: '22.35',
    longitude: '89.18',
    capturedAt: '2026-01-15T10:00:00.000Z',
    areaM2: '50',
    estimatedCarbonTco2e: '0.03',
    aiConfidence: '0.8',
    evidenceHash: 'hash-1',
    metadataHash: 'metahash-1',
    ...overrides,
  };
}

async function createRecord(contract, ctx, overrides = {}) {
  const a = makeArgs(overrides);
  const json = await contract.CreateMRVRecord(
    ctx,
    a.mrvId,
    a.mrvCode,
    a.contributorOrg,
    a.ecosystemType,
    a.latitude,
    a.longitude,
    a.capturedAt,
    a.areaM2,
    a.estimatedCarbonTco2e,
    a.aiConfidence,
    a.evidenceHash,
    a.metadataHash
  );
  return JSON.parse(json);
}

describe('MrvContract', () => {
  let contract;
  let ctx;

  beforeEach(() => {
    contract = new MrvContract();
    ctx = new FakeContext();
  });

  describe('CreateMRVRecord', () => {
    it('creates a PENDING_VALIDATION record with the given fields', async () => {
      const record = await createRecord(contract, ctx);
      expect(record.status).to.equal('PENDING_VALIDATION');
      expect(record.ecosystemType).to.equal('mangrove');
      expect(record.latitude).to.equal(22.35);
      expect(record.tokenAssetId).to.be.null;
    });

    it('rejects an invalid ecosystem type', async () => {
      await expect(createRecord(contract, ctx, { ecosystemType: 'rainforest' })).to.be.rejectedWith(
        /ecosystemType must be one of/
      );
    });

    it('rejects out-of-range coordinates', async () => {
      await expect(createRecord(contract, ctx, { latitude: '999' })).to.be.rejectedWith(/latitude/);
      await expect(createRecord(contract, ctx, { longitude: '-999' })).to.be.rejectedWith(/longitude/);
    });

    it('rejects a duplicate mrvId', async () => {
      await createRecord(contract, ctx);
      await expect(createRecord(contract, ctx, { evidenceHash: 'different-hash' })).to.be.rejectedWith(
        /already exists on-chain/
      );
    });

    it('rejects a duplicate evidence hash across different MRV ids', async () => {
      await createRecord(contract, ctx, { mrvId: 'mrv-1', evidenceHash: 'shared-hash' });
      await expect(
        createRecord(contract, ctx, { mrvId: 'mrv-2', evidenceHash: 'shared-hash' })
      ).to.be.rejectedWith(/already recorded on-chain/);
    });

    it('enforces the configured minimum AI confidence once InitLedger has run', async () => {
      await contract.InitLedger(ctx); // sets minConfidenceThreshold = 0.3
      await expect(createRecord(contract, ctx, { aiConfidence: '0.1' })).to.be.rejectedWith(
        /below the configured minimum/
      );
      await expect(createRecord(contract, ctx, { aiConfidence: '0.5' })).to.not.be.rejected;
    });
  });

  describe('validation and rejection', () => {
    it('ValidateMRVRecord moves PENDING_VALIDATION -> VERIFIED and records the validator', async () => {
      await createRecord(contract, ctx);
      const json = await contract.ValidateMRVRecord(ctx, 'mrv-1', 'validator-1', 'Looks good');
      const record = JSON.parse(json);
      expect(record.status).to.equal('VERIFIED');
      expect(record.validatorId).to.equal('validator-1');
    });

    it('refuses to validate a record that is not PENDING_VALIDATION', async () => {
      await createRecord(contract, ctx);
      await contract.ValidateMRVRecord(ctx, 'mrv-1', 'validator-1', 'ok');
      await expect(contract.ValidateMRVRecord(ctx, 'mrv-1', 'validator-1', 'again')).to.be.rejectedWith(
        /Cannot transition/
      );
    });

    it('RejectMRVRecord requires a reason', async () => {
      await createRecord(contract, ctx);
      await expect(contract.RejectMRVRecord(ctx, 'mrv-1', 'validator-1', '')).to.be.rejectedWith(
        /reason is required/
      );
    });

    it('RejectMRVRecord moves PENDING_VALIDATION -> REJECTED', async () => {
      await createRecord(contract, ctx);
      const json = await contract.RejectMRVRecord(ctx, 'mrv-1', 'validator-1', 'Evidence unusable');
      const record = JSON.parse(json);
      expect(record.status).to.equal('REJECTED');
      expect(record.rejectionReason).to.equal('Evidence unusable');
    });

    it('rejects an arbitrary status change not on the allowed transition graph', async () => {
      await createRecord(contract, ctx);
      await expect(contract.UpdateMRVStatus(ctx, 'mrv-1', 'TOKENIZED')).to.be.rejectedWith(/Cannot transition/);
    });
  });

  describe('IssueCarbonToken', () => {
    it('only tokenizes a VERIFIED record, moving it to TOKENIZED', async () => {
      await createRecord(contract, ctx);
      await expect(contract.IssueCarbonToken(ctx, 'mrv-1', 'BC-000001', 'Org1MSP')).to.be.rejectedWith(
        /Cannot transition/
      );

      await contract.ValidateMRVRecord(ctx, 'mrv-1', 'validator-1', 'ok');
      const tokenJson = await contract.IssueCarbonToken(ctx, 'mrv-1', 'BC-000001', 'Org1MSP');
      const token = JSON.parse(tokenJson);
      expect(token.assetId).to.equal('BC-000001');
      expect(token.mrvId).to.equal('mrv-1');

      const record = JSON.parse(await contract.ReadMRVRecord(ctx, 'mrv-1'));
      expect(record.status).to.equal('TOKENIZED');
      expect(record.tokenAssetId).to.equal('BC-000001');
    });

    it('refuses to issue a second token for the same MRV record', async () => {
      await createRecord(contract, ctx);
      await contract.ValidateMRVRecord(ctx, 'mrv-1', 'validator-1', 'ok');
      await contract.IssueCarbonToken(ctx, 'mrv-1', 'BC-000001', 'Org1MSP');

      await expect(contract.IssueCarbonToken(ctx, 'mrv-1', 'BC-000002', 'Org1MSP')).to.be.rejectedWith(
        /already has a token/
      );
    });

    it('refuses to reuse an assetId for a different MRV record', async () => {
      await createRecord(contract, ctx, { mrvId: 'mrv-1', evidenceHash: 'hash-a' });
      await createRecord(contract, ctx, { mrvId: 'mrv-2', evidenceHash: 'hash-b' });
      await contract.ValidateMRVRecord(ctx, 'mrv-1', 'validator-1', 'ok');
      await contract.ValidateMRVRecord(ctx, 'mrv-2', 'validator-1', 'ok');

      await contract.IssueCarbonToken(ctx, 'mrv-1', 'BC-000001', 'Org1MSP');
      await expect(contract.IssueCarbonToken(ctx, 'mrv-2', 'BC-000001', 'Org1MSP')).to.be.rejectedWith(
        /already exists on-chain/
      );
    });
  });

  describe('reads and queries', () => {
    it('ReadMRVRecord/ReadCarbonToken throw for unknown ids', async () => {
      await expect(contract.ReadMRVRecord(ctx, 'nope')).to.be.rejectedWith(/does not exist/);
      await expect(contract.ReadCarbonToken(ctx, 'nope')).to.be.rejectedWith(/does not exist/);
    });

    it('VerifyEvidenceHash reports existence and the owning MRV id', async () => {
      await createRecord(contract, ctx, { evidenceHash: 'hash-x' });
      const found = JSON.parse(await contract.VerifyEvidenceHash(ctx, 'hash-x'));
      expect(found).to.deep.equal({ exists: true, mrvId: 'mrv-1' });

      const notFound = JSON.parse(await contract.VerifyEvidenceHash(ctx, 'hash-y'));
      expect(notFound.exists).to.be.false;
    });

    it('QueryByEcosystem/QueryByContributor/QueryByStatus filter correctly', async () => {
      await createRecord(contract, ctx, { mrvId: 'mrv-1', evidenceHash: 'h1', ecosystemType: 'mangrove', contributorOrg: 'Org1MSP' });
      await createRecord(contract, ctx, { mrvId: 'mrv-2', evidenceHash: 'h2', ecosystemType: 'seagrass', contributorOrg: 'Org1MSP' });
      await createRecord(contract, ctx, { mrvId: 'mrv-3', evidenceHash: 'h3', ecosystemType: 'mangrove', contributorOrg: 'Org2MSP' });

      const mangroves = JSON.parse(await contract.QueryByEcosystem(ctx, 'mangrove'));
      expect(mangroves.map((r) => r.mrvId).sort()).to.deep.equal(['mrv-1', 'mrv-3']);

      const org1 = JSON.parse(await contract.QueryByContributor(ctx, 'Org1MSP'));
      expect(org1.map((r) => r.mrvId).sort()).to.deep.equal(['mrv-1', 'mrv-2']);

      await contract.ValidateMRVRecord(ctx, 'mrv-1', 'validator-1', 'ok');
      const verified = JSON.parse(await contract.QueryByStatus(ctx, 'VERIFIED'));
      expect(verified.map((r) => r.mrvId)).to.deep.equal(['mrv-1']);

      const all = JSON.parse(await contract.QueryMRVRecords(ctx));
      expect(all).to.have.length(3);
    });

    it('GetTransactionHistory returns every write to the record in order', async () => {
      await createRecord(contract, ctx);
      await contract.ValidateMRVRecord(ctx, 'mrv-1', 'validator-1', 'ok');
      await contract.IssueCarbonToken(ctx, 'mrv-1', 'BC-000001', 'Org1MSP');

      const history = JSON.parse(await contract.GetTransactionHistory(ctx, 'mrv-1'));
      expect(history).to.have.length(3);
      expect(history[0].value.status).to.equal('PENDING_VALIDATION');
      expect(history[1].value.status).to.equal('VERIFIED');
      expect(history[2].value.status).to.equal('TOKENIZED');
    });
  });

  describe('validation config', () => {
    it('rejects an out-of-range confidence threshold', async () => {
      await expect(contract.SetValidationConfig(ctx, '1.5')).to.be.rejectedWith(/between 0 and 1/);
    });

    it('round-trips a valid threshold', async () => {
      await contract.SetValidationConfig(ctx, '0.6');
      const config = JSON.parse(await contract.GetValidationConfig(ctx));
      expect(config.minConfidenceThreshold).to.equal(0.6);
    });
  });
});
