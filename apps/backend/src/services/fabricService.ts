import * as crypto from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import { connect, signers, type Contract, type Gateway, type Identity, type Signer } from '@hyperledger/fabric-gateway';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

const backendRoot = path.resolve(__dirname, '..', '..');

function resolveFabricPath(configuredPath: string): string {
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(backendRoot, configuredPath);
}

let gatewayInstance: Gateway | null = null;
let grpcClient: grpc.Client | null = null;

async function newGrpcConnection(): Promise<grpc.Client> {
  const tlsCert = await readFile(resolveFabricPath(env.FABRIC_TLS_CERT_PATH));
  const credentials = grpc.credentials.createSsl(tlsCert);
  return new grpc.Client(env.FABRIC_PEER_ENDPOINT, credentials, {
    'grpc.ssl_target_name_override': env.FABRIC_PEER_HOST_ALIAS,
  });
}

async function newIdentity(): Promise<Identity> {
  // The signcert filename includes the identity name (e.g. "User1@org1.example.com-cert.pem"),
  // not a fixed "cert.pem" - read whatever's in the directory rather than hardcoding it,
  // same reasoning as newSigner()'s keystore read below.
  const certDir = resolveFabricPath(env.FABRIC_CERT_DIRECTORY_PATH);
  const files = await readdir(certDir);
  const certFile = files[0];
  if (!certFile) throw new Error(`No signing cert found in ${certDir}`);
  const credentials = await readFile(path.join(certDir, certFile));
  return { mspId: env.FABRIC_MSP_ID, credentials };
}

async function newSigner(): Promise<Signer> {
  const keyDir = resolveFabricPath(env.FABRIC_KEY_DIRECTORY_PATH);
  const files = await readdir(keyDir);
  const keyFile = files[0];
  if (!keyFile) throw new Error(`No private key found in ${keyDir}`);
  const privateKeyPem = await readFile(path.join(keyDir, keyFile));
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

async function getGateway(): Promise<Gateway> {
  if (gatewayInstance) return gatewayInstance;

  grpcClient = await newGrpcConnection();
  const identity = await newIdentity();
  const signer = await newSigner();

  gatewayInstance = connect({
    client: grpcClient,
    identity,
    signer,
    // Generous timeouts: this is a local dev network, not a latency-sensitive production path.
    evaluateOptions: () => ({ deadline: Date.now() + 10000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15000 }),
    submitOptions: () => ({ deadline: Date.now() + 15000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 30000 }),
  });
  return gatewayInstance;
}

async function getContract(): Promise<Contract> {
  if (!env.FABRIC_ENABLED) {
    throw new AppError(503, 'BLOCKCHAIN_DISABLED', 'Fabric integration is disabled (FABRIC_ENABLED=false)');
  }
  const gateway = await getGateway();
  const network = gateway.getNetwork(env.FABRIC_CHANNEL_NAME);
  return network.getContract(env.FABRIC_CHAINCODE_NAME);
}

export interface FabricTxResult {
  txId: string;
  resultJson: string;
}

async function submit(fn: string, ...args: string[]): Promise<FabricTxResult> {
  const contract = await getContract();
  try {
    const proposal = contract.newProposal(fn, { arguments: args });
    const transaction = await proposal.endorse();
    const commit = await transaction.submit();
    const status = await commit.getStatus();
    if (!status.successful) {
      throw new AppError(502, 'BLOCKCHAIN_COMMIT_FAILED', `Transaction ${fn} failed to commit (status code ${status.code})`);
    }
    return { txId: transaction.getTransactionId(), resultJson: Buffer.from(transaction.getResult()).toString('utf8') };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err, fn }, 'Fabric transaction submission failed');
    throw new AppError(502, 'BLOCKCHAIN_ERROR', `Fabric transaction ${fn} failed: ${(err as Error).message}`);
  }
}

async function evaluate(fn: string, ...args: string[]): Promise<string> {
  const contract = await getContract();
  try {
    const result = await contract.evaluateTransaction(fn, ...args);
    return Buffer.from(result).toString('utf8');
  } catch (err) {
    logger.error({ err, fn }, 'Fabric query failed');
    throw new AppError(502, 'BLOCKCHAIN_ERROR', `Fabric query ${fn} failed: ${(err as Error).message}`);
  }
}

export const fabric = {
  createMrvRecord: (args: {
    mrvId: string;
    mrvCode: string;
    contributorOrg: string;
    ecosystemType: string;
    latitude: number;
    longitude: number;
    capturedAt: string;
    areaM2: number;
    estimatedCarbonTco2e: number;
    aiConfidence: number;
    evidenceHash: string;
    metadataHash: string;
  }) =>
    submit(
      'CreateMRVRecord',
      args.mrvId,
      args.mrvCode,
      args.contributorOrg,
      args.ecosystemType,
      String(args.latitude),
      String(args.longitude),
      args.capturedAt,
      String(args.areaM2),
      String(args.estimatedCarbonTco2e),
      String(args.aiConfidence),
      args.evidenceHash,
      args.metadataHash
    ),

  validateMrvRecord: (mrvId: string, validatorId: string, reason: string) =>
    submit('ValidateMRVRecord', mrvId, validatorId, reason),

  rejectMrvRecord: (mrvId: string, validatorId: string, reason: string) =>
    submit('RejectMRVRecord', mrvId, validatorId, reason),

  issueCarbonToken: (mrvId: string, assetId: string, ownerOrg: string) =>
    submit('IssueCarbonToken', mrvId, assetId, ownerOrg),

  readMrvRecord: (mrvId: string) => evaluate('ReadMRVRecord', mrvId),
  readCarbonToken: (assetId: string) => evaluate('ReadCarbonToken', assetId),
  verifyEvidenceHash: (evidenceHash: string) => evaluate('VerifyEvidenceHash', evidenceHash),
  getTransactionHistory: (mrvId: string) => evaluate('GetTransactionHistory', mrvId),
  queryMrvRecords: () => evaluate('QueryMRVRecords'),
  queryByEcosystem: (ecosystemType: string) => evaluate('QueryByEcosystem', ecosystemType),
  queryByContributor: (contributorOrg: string) => evaluate('QueryByContributor', contributorOrg),
  queryByStatus: (status: string) => evaluate('QueryByStatus', status),
};

export async function checkFabricHealth(): Promise<boolean> {
  if (!env.FABRIC_ENABLED) return false;
  try {
    await evaluate('QueryMRVRecords');
    return true;
  } catch {
    return false;
  }
}

export function closeFabricConnection(): void {
  gatewayInstance?.close();
  grpcClient?.close();
  gatewayInstance = null;
  grpcClient = null;
}
