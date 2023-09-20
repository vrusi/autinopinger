/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const axios = require("axios");
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { onSchedule } = require("firebase-functions/v2/scheduler");

const config = {
    VERIFY_TOKEN: "",
    PAGE_ACCESS_TOKEN: `EAAPJ0zsrVNwBO0PYdIyhlJEZBNvUJoNF7fEhSx8rMDBc0DXZCkPVWWBGJ
    XfVy1P3ysZBA8GnozFsSyJ02dezfxMdnvWpLCYrlX778wnZAN71FSbwflMhfUsLQVMjpJBUjDUJH
    HLWLJcl1rU4hyCzTmgvANDsHFod6O7m6cQnwzrgLuJt3aAjNQtHvy0JIPS9`,
};

exports.webhook = onRequest(async (request, response) => {
    try {
        if (request.method !== "GET") {
            return;
        }

        logger.info("Verifying webhook");

        const mode = request.query["hub.mode"];
        const token = request.query["hub.verify_token"];
        const challenge = request.query["hub.challenge"];

        // Check if a token and mode is in the query string of the request
        if (mode && token) {
            // Check the mode and token sent is correct
            if (mode === "subscribe" && token === config.VERIFY_TOKEN) {
                // Respond with the challenge token from the request
                logger.info("Webhook verified");
                response.status(200).send(challenge);

            } else {
                // Respond with "403 Forbidden" if verify tokens do not match
                logger.info("Webhook not verified: invalid token");
                response.sendStatus(403);
            }
        }

    } catch (error) {
        logger.error("Error while verifying webhook", error);
        response.sendStatus(500);
    }
});

exports.processMessage = onRequest(async (request, response) => {
    logger.info("Processing message");
    response.sendStatus(200);
    /*
       try {
      if (request.method !== "POST") {
        return;
      }
  
      const message = request.query.message;
  
      logger.info(`Received message: ${JSON.stringify(message)}`);
  
      response.sendStatus(200).send("NOT_IMPLEMENTED");
    } catch (error) {
      logger.error("Error while processing message", error);
      response.sendStatus(500);
    } */
});


exports.checkAndNotify = onSchedule("* * * * *", async () => {
    checkAndNotify();
});

/** Gets the HTML Page of the available driving lessons terms */
async function getTermsPage() {
    try {
        const response = await axios.get("https://www.rezervujsi.sk/autino");
        logger.info("Received terms page");
        return response.data;

    } catch (error) {
        logger.error("Error while getting terms page", error);
        return null;
    }
}

/** Checks whether there are any terms and notifies */
async function checkAndNotify() {
    try {
        const termsPageHtml = await getTermsPage();

        if (!termsPageHtml) {
            return null;
        }

        const noTermsMsg = `V najbližšom období nie sú zverejnené ďalšie termíny,
      v prípade potreby nás prosím kontaktujte.`;

        const hasTerms = !termsPageHtml.includes(noTermsMsg);

        if (hasTerms) {
            logger.info("Found terms, sending notification");
            return true;

        } else {
            logger.info("No terms found");
            return false;
        }
    } catch (error) {
        logger.error("Error while checking and notifying", error);
        return null;
    }
}
