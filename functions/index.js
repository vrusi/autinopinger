const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require('firebase-admin');
const axios = require("axios");
const logger = require("firebase-functions/logger");
const cheerio = require("cheerio");

admin.initializeApp();

const firestore = admin.firestore();
const schedulesCollection = firestore.collection("schedules");

const config = {
    VERIFY_TOKEN: 'VERIFY_TOKEN',
    PAGE_ACCESS_TOKEN: 'PAGE_ACCESS_TOKEN',
    USER_ID: 'USER_ID',
};

const handleVerification = (request, response) => {
    try {
        logger.info("Verifying webhook");
        const mode = request.query["hub.mode"];
        const token = request.query["hub.verify_token"];
        const challenge = request.query["hub.challenge"];

        if (!mode || !token) {
            logger.error("Webhook not verified: missing mode or token.");
            response.sendStatus(403);
        }

        if (mode === "subscribe" && token === config.VERIFY_TOKEN) {
            logger.info("Webhook verified, sending challenge.");
            response.status(200).send(challenge);

        } else {
            logger.error("Webhook not verified: invalid token.");
            response.sendStatus(403);
        }

    } catch (error) {
        logger.error("Error while verifying webhook", error);
        response.sendStatus(500);
    }
}

const handleWebhookEvent = (request, response) => {
    try {
        const { body } = request;
        const { object, entry } = body;

        if (object === 'page') {
            // Iterate over each entry - there may be multiple if batched
            entry.forEach(async function (entry) {
                // Get the webhook event. entry.messaging is an array, but 
                // will only ever contain one event, so we get index 0
                const webhookEvent = entry.messaging[0];
                logger.info(webhookEvent);

                // Save the sender PSID
                await firestore
                    .collection("users")
                    .add({ id: webhookEvent.sender.id });
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

exports.webhook = onRequest(async (request, response) => {
    if (request.method === "GET") {
        handleVerification(request, response);
    } else if (request.method === "POST") {
        handleWebhookEvent(request, response);
    }
});

async function fetchData() {
    try {
        const response = await axios.get("https://www.rezervujsi.sk/autino");
        const data = response.data;
        const scheduleData = [];
        const hasScheduleList = data.includes(`<div class="shedule-day">`);

        if (!hasScheduleList) {
            await firestore.recursiveDelete(schedulesCollection);
            return scheduleData;
        }

        const $ = cheerio.load(data);

        const cleanText = (text) => {
            return text.replaceAll('\n', '').replaceAll('\t', '');
        }

        const parseTime = (timeString) => {
            try {
                const startTime = timeString.slice(0, 5);
                const endTime = timeString.slice(5);
                return `${startTime} - ${endTime}`;
            } catch {
                return timeString;
            }
        }

        $(".shedule-day").each((index, dayElement) => {
            const date = cleanText($(dayElement).find(".shedule-day-title").text());

            $(dayElement).find(".shedule-item ").each((index, element) => {
                const link = `https://www.rezervujsi.sk${$(element).find(".shedule-item-a").attr("href")}`;
                const time = parseTime(cleanText($(element).find(".shedule-item-date span").text()));
                const instructor = cleanText($(element).find(".shedule-item-title").text());
                scheduleData.push({
                    date,
                    time,
                    link,
                    instructor,
                    id: (date + time + instructor).replaceAll(' ', ''),
                });
            });
        });

        const snapshot = await schedulesCollection.get();

        const lastFetchedScheduleIds = snapshot.empty ? [] : snapshot.docs.map(doc => doc.id);
        const newSchedules = scheduleData.filter(schedule => !lastFetchedScheduleIds.includes(schedule.id));

        await firestore.recursiveDelete(schedulesCollection);

        scheduleData.forEach(async (schedule) => {
            await schedulesCollection.doc(schedule.id).set(schedule);
        });

        return newSchedules;

    } catch (error) {
        logger.error("Error while fetching data", error);
    }
}

/** Checks whether there are any terms and notifies */
async function checkAndNotify() {
    try {
        const newSchedules = await fetchData();

        if (!newSchedules || !newSchedules.length) {
            return;
        }

        const messageTitle = "Nove terminy su dostupne:"

        const messageSchedules = newSchedules.map((schedule) => {
            return `${schedule.date}\n${schedule.time}\n${schedule.instructor}\n${schedule.link}`;
        }).join('\n\n');

        const messageFooter = "https://www.rezervujsi.sk/autino"

        const message = `${messageTitle}\n\n${messageSchedules}\n\n${messageFooter}`

        const data = {
            "recipient": {
                "id": config.USER_ID,
            },
            "message": {
                "text": message
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

exports.checkAndNotify = onSchedule("* * * * *", async () => {
    checkAndNotify();
});