// File: functions/getClaimableBalances.js (Constructor Error Fixed)

// *** YAHAN BADLAV KIYA GAYA HAI: Horizon ki jagah seedha Server import kiya gaya hai ***
const { Keypair, Server } = require('stellar-sdk'); 
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const axios = require('axios');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        const { mnemonic } = JSON.parse(event.body);
        if (!mnemonic) {
            return { statusCode: 400, body: JSON.stringify({ success: false, error: "Keyphrase is required." }) };
        }
        
        // *** YAHAN BADLAV KIYA GAYA HAI: new Horizon.Server ki jagah new Server() ka istemal kiya gaya hai ***
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

        const keypair = createKeypairFromMnemonic(mnemonic);
        const response = await server.claimableBalances().claimant(keypair.publicKey()).limit(100).call();
        
        const balances = response.records.map(r => ({ id: r.id, amount: r.amount, asset: "PI" }));

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, balances, publicKey: keypair.publicKey() })
        };

    } catch (error) {
        console.error("Error in getClaimableBalances:", error);
        let detailedError = "An unknown error occurred.";
        if (error.message.includes("Invalid keyphrase")) {
            detailedError = error.message;
        } else if (error.response && error.response.status === 404) {
            detailedError = "This account was not found on the Pi network.";
        } else if (error.message.toLowerCase().includes('timeout')) {
            detailedError = "Request to Pi network timed out.";
        } else {
            detailedError = error.message;
        }
        
        return {
            statusCode: 200, 
            body: JSON.stringify({ success: false, error: detailedError })
        };
    }
};
