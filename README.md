# Autino Pinger

Autino Pinger is a bot designed to monitor the booking page for Autino Driving School, located at [https://www.rezervujsi.sk/autino](https://www.rezervujsi.sk/autino). This bot periodically checks the website for newly scheduled driving lessons and notifies users via Facebook Messenger. It's integrated with the Facebook page of Autino Pinger, so if you send a message to [Autino Pinger's Facebook Page](https://www.facebook.com/profile.php?id=61551434704816), you'll receive updates on available driving lessons.

## Features

- **Web Scraping**: Autino Pinger uses web scraping techniques to extract data from the Autino Driving School booking page. It parses the HTML content to find information about scheduled driving lessons, including date, time, the instructor's name, and booking links.

- **Firebase Integration**: The bot uses Firebase to store and manage data. It maintains a collection of schedules, allowing it to compare newly scraped data with the existing records to identify any new driving lessons.

- **Facebook Messenger Integration**: Autino Pinger interacts with users through Facebook Messenger. When new driving lessons are available, it sends messages to users who have previously messaged the Facebook page.

- **Scheduled Execution**: The bot runs on a schedule using Firebase's scheduled Functions. Each minute it checks for updates on the Autino Driving School booking page and sends notifications when new lessons are found.

## Prerequisites

Before you can run Autino Pinger, you'll need to set up the following:

- **Firebase Project**: You should have a Firebase project set up, and the bot's configuration, including the service account key, should be properly configured.

- **Facebook Page and Access Token**: Autino Pinger integrates with Facebook Messenger. Ensure you have a Facebook Page for your bot, and you'll need to obtain a Page Access Token for sending messages.

- **Verify Token**: You need a verify token for your webhook, used to verify the webhook subscription with Facebook.

## Installation

To set up Autino Pinger:

1. Clone this repository to your local machine.
2. Install the required Node.js packages by running: `npm install`.
3. Set up your Firebase and Facebook configurations by editing the `config` object in your code.

## Usage

- **Webhook Verification**: When setting up the webhook for your Facebook Page, the bot provides a verification mechanism to confirm the connection.

- **Scheduled Execution**: The bot is designed to run on a schedule using Firebase's scheduler. You can define the schedule using the `onSchedule` function.

- **Facebook Messaging**: Users who send messages to the Facebook Page associated with your bot will receive notifications when new driving lessons become available.