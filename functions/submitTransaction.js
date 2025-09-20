// File: functions/submitTransaction.js (Constructor Error Fixed)

// *** YAHAN BADLAV KIYA GAYA HAI ***
const { Keypair, Server, Operation, TransactionBuilder, Asset } = require('stellar-sdk');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const axios = require('axios');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        const params = JSON.parse(event.body);
        
        // *** YAHAN BADLAV KIYA GAYA HAI ***
        const server = new Server("https://api.mainnet.minepi.com", {
            httpClient: axios.create({ timeout: 20000 })
        });
        
        const createKeypairFromMnemonic = (m) => {
            try {
                return Keypair.fromRawEd25519Seed(derivePath("m/44'/314159'/0'", mnemonicToSeedSync(m).toString('hex')).key);
            } catch (e) {
                throw new Error("Invalid keyphrase. Please check for typos or extra spaces.");
            }
        };
        
        const senderKeypair = createKeypairFromMnemonic(params.senderMnemonic);
        
        const accountToLoad = await server.loadAccount(senderKeypair.publicKey());
        const fee = await server.fetchBaseFee();
        
        const tx = new TransactionBuilder(accountToLoad, { fee, networkPassphrase: "Pi Network" });

        if (params.operation === 'claim_and_transfer') {
            tx.addOperation(Operation.claimClaimableBalance({
                balanceId: params.claimableId,
                source: senderKeypair.publicKey()
            }));
        }
        
        tx.addOperation(Operation.payment({
            destination: params.receiverAddress,
            asset: Asset.native(),
            amount: params.amount.toString(),
            source: senderKeypair.publicKey()
        }));

        const transaction = tx.setTimeout(60).build();
        transaction.sign(senderKeypair);
        
        const result = await server.submitTransaction(transaction);

        if (result && result.hash) {
             return {
                statusCode: 200,
                body: JSON.stringify({ success: true, response: result })
            };
        } else {
            throw new Error("Transaction was submitted but no hash was returned.");
        }

    } catch (error) {
        console.error("Error in submitTransaction:", error);
        let detailedError = "An unknown error occurred during transaction.";
        if (error.response?.data?.extras?.result_codes) {
            detailedError = "Transaction Failed: " + JSON.stringify(error.response.data.extras.result_codes);
        } else if (error.response?.status === 404) {
            detailedError = "The sender account was not found on the Pi network.";
        } else {
            detailedError = error.message;
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ success: false, error: detailedError })
        };
    }
};
