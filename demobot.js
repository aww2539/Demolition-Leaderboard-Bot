const Discord = require("discord.js");
const client = new Discord.Client();
// const config = require("./config.json"); // For local Testing only
const leaderboard = require("./leaderboard.json");
const highscores = require("./highscores.json");
const fs = require('fs');
const fetch = require('isomorphic-fetch');
const Dropbox = require('dropbox').Dropbox;
const http = require('http');
let dbx = new Dropbox({accessToken: process.env.dropToken, fetch: fetch});



client.on("ready", () => {
    // Downloads and saves dropbox files of leaderboards
    // Allows cross-session saving of data and cloud access from other apps
    dbx.filesDownload({path: "/leaderboard.json"})
        .then(function (data) {
            fs.writeFile("./leaderboard.json", data.fileBinary, 'binary', function (err) {
                if (err) { throw err; }
                console.log('File: ' + data.name + ' saved.');
            });
        })
        .catch(function (err) {
            throw err;
        });
    dbx.filesDownload({path: "/leaderboard.csv"})
        .then(function (data) {
            fs.writeFile("./leaderboard.csv", data.fileBinary, 'binary', function (err) {
                if (err) { throw err; }
                console.log('File: ' + data.name + ' saved.');
            });
        })
        .catch(function (err) {
            throw err;
        });
    // connects to server to please heroku
    http.createServer().listen(process.env.PORT, function () {
        console.log('Express server listening on' + process.env.PORT);
    });
    console.log("I am ready!");
    // keeps awake
    setInterval(function() {
        http.get("http://demo-leaderboard.herokuapp.com/");
    }, 300000);
});

// when the bot sees a message
client.on("message", message => {
    // Ignores messages from bots to stop abuse
    if (message.author.bot) return;
    // Ensures the message starts with the prefix "D:"
    if(message.content.indexOf(process.env.prefix) !== 0) return;
    // Defines args
    const args = message.content.slice(process.env.prefix.length).trim().split(/ +/g);
    // Saves author id to verify identity
    let author = message.author.id;
    // Allows creator to authorize top 20 users to post their scores
    // Syntax :
    //  D: Authorize DiscordID Name
    if (author == leaderboard.Car.Discord && args[0] == "Authorize") {
        let name = "";
        if (args.length > 3) {
            name = args[2];
            for (let i = 3; i < args.length; i++) {
                name = name + " " + args[i];
            }
        } else {
            name = args[2];
        }
        console.log(name);
        leaderboard[name].Discord = args[1];
        leaderboard[name].Authorized = 1;
        upload(message);
        console.log("Authorized " + name);

    // Ensures proper command syntax
    // Prevents short or long commands from messing up data
    } else if (args.length < 4 || args.length > 8) {
        message.channel.send("Try updating your stats with the following format: D: # of demos " +
            "E: # of exterminations Your Username\n Ex: D: 200 E: 10 Demo Leaderboard");

    // Ensures the Demolition and Exterminator counts are numbers
    } else if (isNaN(parseInt(args[0])) || isNaN(parseInt(args[2]))) {
        message.channel.send("Try updating your stats with the following format: D: # of demos " +
            "E: # of exterminations Your Username\n Ex: D: 200 E: 10 Demo Leaderboard");

    // Updates leaderboard if the command is correct
    } else {

        let name = args[3];
        // Sets name variable for long names with multiple spaces
        // One word names are left alone
        if (args.length > 4) {
            for (let i = 4; i < args.length; i++) {
                name = name + " " + args[i];
            }
        }

        // console.log(leaderboard.hasOwnProperty(name));
        console.log(leaderboard[name]);

        // Keeps track to ensure the leaderboard has to be updated in dropbox
        let changed = false;

        // If the leaderboard doesn't include the name, adds it
        if (!leaderboard[name]) {
            leaderboard[name] = {Authorized: 0, Discord: "", Demos: 0, Exterminations: 0};
        }

        // If the leaderboard doesn't have a discord ID attached, adds it
        if (!leaderboard[name].Discord) {
            leaderboard[name].Discord = author;
        }

        // Backdoor for creator to upload any data
        // Useful for Reddit users and manual changes
        if (author == leaderboard.Car.Discord) {
            leaderboard[name].Demos = args[0];
            leaderboard[name].Exterminations = args[2];
            changed = true;

        // Ensures only the Discord ID associated with a score can change their data
        } else if (leaderboard[name].Discord == author) {
            // Only authorized users can upload top 20 scores
            // Needs creator permission to do so
            if (leaderboard[name].Authorized == 0) {
                if (parseInt(args[0], 10) > parseInt(highscores.manualDemoLimit, 10)) {
                    message.channel.send("Congratulations, your stats qualify for a top 20 position! " +
                        "(A top 20 submission requires manual review from an admin and consequently may take " +
                        "longer to be accepted). A screenshot may be requested if your submission is suspect or " +
                        "results in a significant change in position. If you have any questions, " +
                        "please contact an admin or JerryTheBee");
                } else if (parseInt(args[2], 10) > parseInt(highscores.manualExtermLimit, 10)) {
                    message.channel.send("Congratulations, your stats qualify for a top 20 position! " +
                        "(A top 20 submission requires manual review from an admin and consequently may take " +
                        "longer to be accepted). A screenshot may be requested if your submission is suspect or " +
                        "results in a significant change in position. If you have any questions, " +
                        "please contact an admin or JerryTheBee");
                // Non top 20 scores from unauthorized users are allowed
                // Allows new members to add themselves
                } else {
                    leaderboard[name].Demos = args[0];
                    leaderboard[name].Exterminations = args[2];
                    changed = true;
                }
            // Checks against the top score
            // Only user authorized to update the top score is the record holder toothboto
            } else if (author != leaderboard.toothboto.Discord) {
                if (parseInt(args[0], 10) > parseInt(highscores.leaderDemos, 10)) {
                    message.channel.send("Congrats on the top place for Demos! " +
                        "Please send verification to an admin before we can verify your spot.");
                } else if (parseInt(args[2], 10) > parseInt(highscores.leaderExterm, 10)) {
                    message.channel.send("Congrats on the top place for Exterminations! " +
                        "Please send verification to an admin before we can verify your spot.");
                // Authorized users can update scores lower than the top spot
                } else {
                    leaderboard[name].Demos = args[0];
                    leaderboard[name].Exterminations = args[2];
                    changed = true;
                }
            }
        // Messages if the account is registered to another player
        } else {
            message.channel.send("Cannot update leaderboard for other users, " +
                "Please DM JerryTheBee if something is wrong");
        }

        // Saves the leaderboard in a JSON, accessible by player name
        fs.writeFile("leaderboard.json", JSON.stringify(leaderboard), (err) => {
            if (err) throw err;
            console.log('Wrote Json');
        });

        let content = "\n" + name + "," + args[0] + "," + args[2];

        // Adds to running CSV, which works better with R Shiny site
        fs.appendFile("leaderboard.csv", content, (err) => {
            if (err) throw err;
            console.log('Appended CSV');
        });

        // If changed, uploads changes
        if (changed) {
            upload(message);
        }
    }
});

// Uploads updated files to Dropbox
function upload(message) {
    fs.readFile("leaderboard.csv", function (err, data) {
        if (err) {
            throw err;
        }
        // console.log(data.toString());
        dbx.filesUpload({path: '/leaderboard.csv', contents: data, mode: "overwrite"})
            .catch(function (error) {
                console.error(error);
            });
    });


    message.channel.send("Updated Leaderboard!");
    dbx.filesUpload({path: '/leaderboard.json', contents: JSON.stringify(leaderboard), mode: "overwrite"})
        .catch(function (error) {
            console.error(error);
        });
}

// Logs into Discord
client.login(process.env.token);