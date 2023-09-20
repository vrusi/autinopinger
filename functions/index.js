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
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp();

const config = {
    VERIFY_TOKEN: "VERIFY_TOKEN",
    PAGE_ACCESS_TOKEN: 'PAGE_ACCESS_TOKEN',
    USER_ID: 'USER_ID',
};

exports.webhook = onRequest(async (request, response) => {
    if (request.method === "GET") {
        try {

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
    } else if (request.method === "POST") {
        try {
            // Parse the request body from the POST
            const body = request.body;

            // Check the webhook event is from a Page subscription
            if (body.object === 'page') {

                // Iterate over each entry - there may be multiple if batched
                body.entry.forEach(async function (entry) {
                    // Get the webhook event. entry.messaging is an array, but 
                    // will only ever contain one event, so we get index 0
                    const webhook_event = entry.messaging[0];
                    logger.info(webhook_event);

                    // Save the sender PSID
                    await getFirestore()
                        .collection("users")
                        .add({id: webhook_event.sender.id});
                });

                // Return a '200 OK' response to all events
                response.status(200).send('EVENT_RECEIVED');

            } else {
                // Return a '404 Not Found' if event is not from a page subscription
                response.sendStatus(404);
            }

        } catch (error) {
            logger.error("Error while processing webhook event", error);
            response.sendStatus(500);
        }

    }
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

        const hasNoTerms = termsPageHtml.includes(noTermsMsg);

        if (hasNoTerms) {
            return;
        }

        const data = {
            "recipient": {
                "id": config.USER_ID,
            },
            "message": {
                "text": "Nove terminy su dostupne: https://www.rezervujsi.sk/autino"
            }
        };

        axios({
            method: 'POST',
            url: 'https://graph.facebook.com/v2.6/me/messages',
            params: {
                'access_token': config.PAGE_ACCESS_TOKEN
            },
            data,
        }).then(res => {
            if (res.status === 200) {
                const body = res.data
                const recipientId = body.recipient_id;
                const messageId = body.message_id;

                if (messageId) {
                    logger.info(`Successfully sent message with id ${messageId} to recipient ${recipientId}`);
                } else {
                    logger.info(`Successfully called Send API for recipient ${recipientId}`);
                }
            }
            else {
                logger.error(`Failed calling Send API ${res.status} ${res.statusText} ${res.data.error}`);
            }

        }).catch(error => {
            logger.error("Axios couldn't handle request", error);
        })
    } catch (error) {
        logger.error("Error while checking and notifying", error);
        return null;
    }
}

