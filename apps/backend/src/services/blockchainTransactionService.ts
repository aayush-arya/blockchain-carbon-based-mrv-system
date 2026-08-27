import { env } from '../config/env';
import { db } from '../db/client';
import type { ChaincodeFunction } from '../db/types';

export async function recordBlockchainTransaction(params: {
  mrvRecordId: string;
  chaincodeFunction: ChaincodeFunction;
  fabricTxId: string;
  submittedBy: string | null;
}): Promise<void> {
  await db
    .insertInto('blockchain_transactions')
    .values({
      mrv_record_id: params.mrvRecordId,
      chaincode_function: params.chaincodeFunction,
      fabric_tx_id: params.fabricTxId,
      channel_name: env.FABRIC_CHANNEL_NAME,
      chaincode_name: env.FABRIC_CHAINCODE_NAME,
      submitted_by: params.submittedBy,
    })
    .execute();
}
