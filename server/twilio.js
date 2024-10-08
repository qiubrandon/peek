// Download the helper library from https://www.twilio.com/docs/node/install
require('dotenv').config();
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createToken() {
  const token = await client.tokens.create();

  console.log(token);
}

createToken();