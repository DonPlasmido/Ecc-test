import { WORLDS } from './contract/worlds';
import { transactionRepositoryContract } from './contract/transactionRepository.contract';

for (const [label, create] of WORLDS) transactionRepositoryContract(label, create);
