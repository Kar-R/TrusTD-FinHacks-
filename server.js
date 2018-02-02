var express = require('express');
var app = express();
var unirest = require('unirest');
var bodyParser = require('body-parser');
var firebase = require('firebase');
var header = {
	'Authorization':'Bearer NjZmYWM3N2ItODBjNS00MjEzLTljN2YtZjE2Mjk3OTk1ODZkM2E5YTdlOGQtYmFl',
	'Content-Type':'application/json'
};
var transactionCount=0;
//-------
var config = {
	//Insert API Keys
};

var ref = new firebase.initializeApp(config);
var firebaseDataRef = ref.database();
//-------

var previousMessage="";
var previousName="";
var previousMention="";
var previousAmount=0;
var previousEmail="";
var objects = "" ;
var intentName = "" ;


app.use( bodyParser.json() );

app.post('/', function(req, res) {
	var messageId="";
	var message="";
	var email="";
	var nameId="";
	var name="";
	var roomId="";
	var mentionedIds=[];
	var mentionedId1="";
	var mentionedId2="";

	res.end("ok");
	console.log("Ok, received");
	messageId = req.body.data.id;
	nameId = req.body.data.personId;
	console.log(messageId);
	var sendMessageID = "https://api.ciscospark.com/v1/messages/" + messageId;
	var sendNameID = "https://api.ciscospark.com/v1/people/"+nameId;

	if ('mentionedPeople' in req.body.data){
		mentionedIds = req.body.data.mentionedPeople;
		//Check if anyone other than the bot is mentioned
		if (mentionedIds[1] !== null){
			mentionedId1 = mentionedIds[0];
			mentionedId2 = mentionedIds[1];
		}
	}
	var sendMention = "https://api.ciscospark.com/v1/people/"+mentionedId2;
	
	//functions checks to see how much one person owes another 'how' and 'much' must be first 2 arguments
	unirest.get(sendMessageID).headers(header)
	.end(function(res){
		if (res.body.text.indexOf('how') !== -1 || res.body.text.indexOf('much') !== -1){

			unirest.get(sendNameID).headers(header)
			.end(function(response){
				name = response.body.displayName;

				unirest.get(sendMention).headers(header)
				.end(function(responseName){

					var nameMention = responseName.body.displayName;
					//previousMention = nameMention;

					unirest.post("https://api.ciscospark.com/v1/messages")
					.headers(header)
					.send({
						'roomId': res.body.roomId,
						'text' : 'Let me check '+ name.split(' ')[0] //Parses name checks for money owed
					})
					.end(function(req, resp){
							MyCalc(name, res.body.roomId, header, nameMention);
						
					});
				});
			})
		}
		// if 'yes' is not by the person who is sent the IOU, then does not validate
		if (res.body.text.indexOf('yes') !== -1 && mentionedId2 == null){

			unirest.get(sendNameID).headers(header)
			.end(function(response){
				name = response.body.displayName;


				if (name === previousMention){
					unirest.post("https://api.ciscospark.com/v1/messages")
					.headers(header)
					.send({
						'roomId': res.body.roomId,
						'text' : 'IOU Confirmed!'
					})
					.end(function(req, resp){
						var myData = {
							'giver': previousName,
							'amount': previousAmount,
							'email': previousEmail
						}
						//Push to database
						if (previousMention !== null){
							transactionCount++;
							DataPush(previousMention, transactionCount, myData);
						}
					});
				}else{
					unirest.post("https://api.ciscospark.com/v1/messages")
					.headers(header)
					.send({
						'roomId': res.body.roomId,
						'text' : 'You\'re not authorized to confirm!'
					})
					.end(function(req, resp){
						//
					});
					return;
				}
			})
		}
		if (res.body.text.indexOf('no') !== -1 && mentionedId2 == null){
			unirest.get(sendNameID).headers(header)
			.end(function(response){
				name = response.body.displayName;
				if (name === previousMention){
					unirest.post("https://api.ciscospark.com/v1/messages")
					.headers(header)
					.send({
						'roomId': res.body.roomId,
						'text' : 'IOU did not go through!'
					})
					.end(function(req, resp){
						//Reset iou parameters
						var previousMessage="";
						var previousName="";
						var previousMention="";
						var previousAmount="";
						var previousEmail="";
						return;
					});
				}else{
					unirest.post("https://api.ciscospark.com/v1/messages")
					.headers(header)
					.send({
						'roomId': res.body.roomId,
						'text' : 'You\'re not authorized to confirm!'
					})
					.end(function(req, resp){
						//
					});
					return;
				}
			})
		}
		//Checks to see how much you owe someone in total 
		//'TrusTD' and 'how' must be first arg and second arg respectively with the mentioned name
		// returns money value of objects stored
		if (res.body.personEmail.indexOf("TrusTD") !== -1 || mentionedId2 == null){
			return;
		} 
		if (mentionedId2 !== null && res.body.text.indexOf('how') === -1){
			message = res.body.text;
			//console.log("Message: ", message);
			//APIQuery(message);
			var amount;
			if (message.match( /\d+/g )!== null){
				amount = message.match( /\d+/g)[0];
				previousAmount = amount;
			}
			
			email = res.body.personEmail;
			//console.log( "calling API" + message);
			objects="";
			APIQuery (JSON.stringify (message));

			previousEmail = email;
			//console.log("Email: ", email);

			unirest.get(sendNameID).headers(header)
			.end(function(response){

				name = response.body.displayName;
				previousName = name;
				//console.log("Name: ", name);


				unirest.get(sendMention).headers(header)
				.end(function(responseName){

					var nameMention = responseName.body.displayName;
					previousMention = nameMention;

					previousAmount = (moneyvalue(objects)===0)? previousAmount: moneyvalue(objects);
					//console.log(moneyvalue(objects));
					unirest.post("https://api.ciscospark.com/v1/messages")
					.headers(header)
					.send({
						'roomId': res.body.roomId,
						'text' : 'Hey: '+ nameMention + ', ' + name + ' says you owe them ' + (objects?objects:"money:" )+ ' $' + previousAmount + '. Can you please confirm?'
					})
					.end(function(req, res){
						//console.log(res);
					});
				})
			})
		}
	});
});

app.get('/tropo', function(req, res) {
	console.log(req.body);
})

app.listen(8080, function() {
	console.log('listening on *: ' + 8080);
});

//function to calculate ledger 
//Calculates amountOwed and returns a message with the value
function MyCalc(name, room, header, mention) {
	firebaseDataRef.ref().once('value')
	.then(function(snapshot) {
  		var givenData = snapshot.val();
  		var amountCurr = 0;
  		var amountOwed = 0;
  		var personOwed = "";
  		var personOwedPrevious = "";

  		// 	unirest.post("https://api.ciscospark.com/v1/messages")
				// .headers(header)
				// .send({
				// 	'roomId': room,
				// 	'text' : name.split(' ')[0]+', you do not appear to owe anything to anybody'
				// })
				// .end(function(req, resp){
				// 	//Done
				// });
  		
		for (var key in givenData.IOUs){
			for(var key2 in givenData.IOUs[key]){
				for (var key3 in givenData.IOUs[key][key2]){
					//Do calculation algorithm
					
					if (key3 === 'amount'){
							amountCurr = parseInt(givenData.IOUs[key][key2][key3]);
					}
					if (key.indexOf(mention) !== -1 && givenData.IOUs[key][key2][key3] === name){
						//console.log('owed', amountCurr);
						amountOwed = amountOwed - amountCurr;
					}
					if (key.indexOf(name) !== -1 && givenData.IOUs[key][key2][key3] === mention){
						//console.log('taken',amountCurr);
						amountOwed = amountOwed + amountCurr;
					}
					//console.log(givenData.IOUs[key][key2][key3]);
				}
			}
		}
		console.log(amountOwed);
		if (amountOwed === 0){
			unirest.post("https://api.ciscospark.com/v1/messages")
			.headers(header)
			.send({
				'roomId': room,
				'text' : name.split(' ')[0]+', you do not appear to owe anything to '+ mention.split(' ')[0]
			})
			.end(function(req, resp){
				//Done
			});
		} if (amountOwed < 0){
			unirest.post("https://api.ciscospark.com/v1/messages")
			.headers(header)
			.send({
				'roomId': room,
				'text' : name.split(' ')[0]+', it seems like '+ mention.split(' ')[0]+ ' owes you around $'+ Math.abs(amountOwed)
			})
			.end(function(req, resp){
				//Done
			});
		} else if (amountOwed !== 0){
			unirest.post("https://api.ciscospark.com/v1/messages")
			.headers(header)
			.send({
				'roomId': room,
				'text' : name.split(' ')[0]+', it seems like you owe '+ mention.split(' ')[0]+ ' around $'+ Math.abs(amountOwed)
			})
			.end(function(req, resp){
				//Done
			});
		}
  	});
}

// 
function DataPush(taker, count, data) {
    firebaseDataRef.ref().child('IOUs').child(taker).push(data)
    .then((res) => {
        // Done
        //Reset iou perameters
		var previousMessage="";
		var previousName="";
		var previousMention="";
		var previousAmount=0;
		var previousEmail="";
    })
    .catch((err) => {
        // Done
    });
}

//used to parse through messages in chatroom
function APIQuery(message){
	// intentName
	// objects
	// given-name
	// var message = 'TrusTD calen owes me dinner';
	trimstr =message.substring(7, message.length)
	console.log ("inAPIQ" + trimstr);
	var queryURL = 'https://api.api.ai/api/query?v=20150910&query='+  trimstr+'&lang=en&sessionId=234948ff-72a1-460f-ad7f-049dd8a24415&timezone=2016-11-19T21:54:43-0500';
	var header = {
		'Authorization':'Bearer 25c026f44982440e9b773e38419d0382',
		'Content-Type':'application/json'
	};
	unirest.get(queryURL).headers(header)
		.end(function(response){
			var jsonobj = JSON.parse(   response.raw_body);
			var jresult = jsonobj.result;

			objects = jresult.parameters.objects;
			intentName = jresult.metadata.intentName;
			//money = jresult.parameters.currency.amount;
			//console.log(response.raw_body);
			console.log( objects + intentName);
		}) 
};

//money values of various objects
function moneyvalue(objectname){
val = 0	
if (objectname.indexOf('money') !== -1){
	val= 0;
}
else if (objectname.indexOf('apology') !== -1){
	val= 5
}

else if (objectname.indexOf('tickets') !== -1){
	val= 30
}
else if (objectname.indexOf('move') !== -1){
	val= 100
}
else if (objectname.indexOf('transport') !== -1){
	val= 20
}
else if (objectname.indexOf('beverage') !== -1){
	val= 5
}
else if (objectname.indexOf('food') !== -1){
	val= 10
}

else if (objectname.indexOf('alcohol') !== -1){
	val= 10
}
return val;
}	// intentName

