import * as web3 from '@solana/web3.js';
import { initializeKeypair } from './helpers';

async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl('devnet'), 'finalized');
  const payer = await initializeKeypair(connection, '~/.config/solana/id.json');

  const mint = web3.Keypair.generate();
}

main()
  .then(() => {
    console.log('Finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
