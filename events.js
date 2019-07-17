// events.js ~ Copyright 2019 Paul Beaudet ~ License MIT
var querystring = require('querystring');  // Parse urlencoded body
var crypto = require('crypto');            // verify request from slack is from slack with hmac-256
var https = require('https');

var slack = {
    verify: function(event){
        var timestamp = event.headers['X-Slack-Request-Timestamp'];        // nonce from slack to have an idea
        var secondsFromEpoch = Math.round(new Date().getTime() / 1000);    // get current seconds from epoch because thats what we are comparing with
        if(Math.abs(secondsFromEpoch - timestamp > 60 * 5)){return false;} // make sure request isn't a duplicate
        var computedSig = 'v0=' + crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET).update('v0:' + timestamp + ':' + event.body).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(event.headers['X-Slack-Signature'], 'utf8'), Buffer.from(computedSig ,'utf8'));
    },
    send: function(msg, webhook){
        var postData = JSON.stringify({'text': msg});
        var options = {
            hostname: 'hooks.slack.com', port: 443, method: 'POST',
            path: webhook ? webhook : process.env.LOG_WH,
            headers: {'Content-Type': 'application/json','Content-Length': postData.length}
        };
        var req = https.request(options, function(res){}); // just do it, no need for response
        req.on('error', function(error){console.log(error);});
        req.write(postData); req.end();
    },
    handler: function(event, context, callback){
        var response = {statusCode:403, headers: {'Content-type': 'application/json'}};
        if(slack.verify(event)){
            response.statusCode = 200;
            try{event.body = JSON.parse(event.body);}catch(error){console.log(error); callback(null, response);}
            if(event.body.event.type === "team_join"){
                callback(null, response);
                slack.onTeamJoin(event.body.event, slack.send);
            } else if (event.body.type === "url_verification"){
                response.body = JSON.stringify({challenge: event.body.challenge});
                callback(null, response);
            } else {console.log('unhandled event type: ' + JSON.stringify(event.body)); callback(null, response);}
        } else {console.log('not slack?'); callback(null, response);}
    },
    onTeamJoin: function(event, log){ // pass fuction on where to log (slack, cloudwatch, console, ect)
        slack.send('Welcome to hiking buddies slack '+event.user.real_name+'! (<@'+ event.user.id +
            '>) \nThis is a good channel to introduce yourself for those that don\'t know you.', process.env.NEW_MEMBERS_WH);
    }
};

exports.incoming = slack.handler;
