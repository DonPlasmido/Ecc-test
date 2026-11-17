import { catalogRepositoriesContract } from './contract/catalogRepositories.contract';
import { WORLDS } from './contract/worlds';

for (const [label, create] of WORLDS) catalogRepositoriesContract(label, create);
