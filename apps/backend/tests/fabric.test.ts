import { afterAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { checkFabricHealth, closeFabricConnection, fabric } from '../src/services/fabricService';

// These tests talk to the real local Fabric network (see network/README.md) and are skipped
// entirely when it isn't up, rather than mocking the Gateway SDK - a mocked test wouldn't have
// caught any of the real integration issues (TLS, MSP identity, endorsement) this actually hit.
describe.runIf(env.FABRIC_ENABLED)('Fabric chaincode integration', () => {
  afterAll(() => {
    closeFabricConnection();
  });

  it('reports the network as healthy', async () => {
    const healthy = await checkFabricHealth();
    expect(healthy).toBe(true);
  });

  it('creates, reads, validates, and tokenizes an MRV record end-to-end on-chain', { timeout: 30000 }, async () => {
    const mrvId = `test-mrv-${Date.now()}`;
    const evidenceHash = `test-hash-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const created = await fabric.createMrvRecord({
      mrvId,
      mrvCode: `MRV-TEST-${Date.now()}`,
      contributorOrg: 'Org1MSP',
      ecosystemType: 'mangrove',
      latitude: 22.35,
      longitude: 89.18,
      capturedAt: new Date().toISOString(),
      areaM2: 50,
      estimatedCarbonTco2e: 0.03,
      aiConfidence: 0.8,
      evidenceHash,
      metadataHash: `meta-${evidenceHash}`,
    });
    expect(created.txId).toBeTruthy();
    const createdRecord = JSON.parse(created.resultJson);
    expect(createdRecord.status).toBe('PENDING_VALIDATION');

    const read = JSON.parse(await fabric.readMrvRecord(mrvId));
    expect(read.mrvId).toBe(mrvId);

    const verifyHash = JSON.parse(await fabric.verifyEvidenceHash(evidenceHash));
    expect(verifyHash).toEqual({ exists: true, mrvId });

    const validated = await fabric.validateMrvRecord(mrvId, 'validator-integration-test', 'Looks good');
    expect(JSON.parse(validated.resultJson).status).toBe('VERIFIED');

    const assetId = `BC-TEST-${Date.now()}`;
    const tokenized = await fabric.issueCarbonToken(mrvId, assetId, 'Org1MSP');
    const token = JSON.parse(tokenized.resultJson);
    expect(token.assetId).toBe(assetId);
    expect(token.mrvId).toBe(mrvId);

    const finalRecord = JSON.parse(await fabric.readMrvRecord(mrvId));
    expect(finalRecord.status).toBe('TOKENIZED');
    expect(finalRecord.tokenAssetId).toBe(assetId);

    const history = JSON.parse(await fabric.getTransactionHistory(mrvId));
    expect(history.length).toBeGreaterThanOrEqual(3); // create, validate, tokenize
  });

  it('rejects a duplicate evidence hash on-chain', async () => {
    const sharedHash = `dup-hash-${Date.now()}`;
    const first = `test-mrv-a-${Date.now()}`;
    const second = `test-mrv-b-${Date.now()}`;

    await fabric.createMrvRecord({
      mrvId: first,
      mrvCode: `MRV-A-${Date.now()}`,
      contributorOrg: 'Org1MSP',
      ecosystemType: 'seagrass',
      latitude: 10,
      longitude: 77,
      capturedAt: new Date().toISOString(),
      areaM2: 20,
      estimatedCarbonTco2e: 0.01,
      aiConfidence: 0.9,
      evidenceHash: sharedHash,
      metadataHash: 'meta-a',
    });

    await expect(
      fabric.createMrvRecord({
        mrvId: second,
        mrvCode: `MRV-B-${Date.now()}`,
        contributorOrg: 'Org1MSP',
        ecosystemType: 'seagrass',
        latitude: 10,
        longitude: 77,
        capturedAt: new Date().toISOString(),
        areaM2: 20,
        estimatedCarbonTco2e: 0.01,
        aiConfidence: 0.9,
        evidenceHash: sharedHash,
        metadataHash: 'meta-b',
      })
    ).rejects.toThrow();
  });
});
