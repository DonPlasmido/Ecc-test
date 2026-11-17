import { dataSnapshotContract } from './contract/dataSnapshot.contract';
import { WORLDS } from './contract/worlds';

for (const [label, create] of WORLDS) dataSnapshotContract(label, create);
