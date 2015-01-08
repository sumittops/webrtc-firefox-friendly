$(document).ready(function(){
			var socket = io.connect();
			var $chatWrap = $('#chatWrap');
			var $loginWrap = $('#loginWrap');
			var $loginForm = $('#loginForm');
			var $chatForm = $('#chatForm');
			var $msg = $('#message');
			var $username = $('#name');
			var $chatScoll = $('#chatScroll').find('ul');
			var self;
			if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
				$('#chatWrap >div').css('width','100%');
				$('#chatWrap >div').css('height','66%');
				$('#chatWrap >div').css('float','bottom');
			}
			function loginUser(newUser){
				socket.emit('new user',newUser,function(data){
						if(data){
							$chatWrap.slideDown();
							$loginWrap.slideUp();
							$('#title').html('ChatApp v0.0.2 - Welcome, '+newUser);
							$username.val('');
						}else{
							$('#loginMsg').html('Sorry! A user by that name already exists. Try some other name.');
						}
					});
			}
			$loginForm.on('submit',function(e){
				e.preventDefault();
				var newUser = $username.val();
				self = newUser;
				console.log('want to connect as '+newUser);
				if(newUser != ''){
					$(this).disabled = true;
					loginUser(newUser);
				}else{
						$('#loginMsg').html('Please enter a valid username to connect.');
						$(this).disabled = false;
				}
			});
			$chatForm.on('submit',function(e){
				e.preventDefault();
				var msg = $('#message').val();
				if(msg!='')
					socket.emit('new message',msg);
				$('#message').val('');
			});
			socket.on('users',function(data){
				var listHtml = '';
				for(i=0;i<data.length;i++){
					listHtml += '<li>'+data[i]+'</li>';
				}
				$('#userList').html(listHtml);
			});
			socket.on('message',function(data){
				$('#chatScroll>ul').prepend('<li><b>'+data.name+': </b>'+data.msg+'</li>');
			});
//CODE FOR WEBRTC AND VIDEO CHAT STARTS HERE....
			
navigator.getUserMedia = navigator.getUserMedia||navigator.webkitGetUserMedia||navigator.mozGetUserMedia;
var localVideoElement = document.getElementById('localScreen');
var remoteVideoElement = document.getElementById('remoteScreen');
//Streams
var localStream, remoteStream;
//Data channel Information
var sendChannel, receiveChannel;
//Flags
var isStarted = false;
//the PeerConnection object
var pc;
//PeerConnection ICE protocol configuration for chrome
var isChrome = !!navigator.webkitGetUserMedia;
var STUN = {
	url: isChrome ? 'stun:stun.l.google.com:19302' :'stun:23.21.150.121'
};
var TURN = { url: 'turn:numb.viagenie.ca',
    credential: 'muazkh',
    username: 'webrtc@live.com'};

var pc_config = {'iceServers':[STUN,TURN]};
var pc_constraints = {
	'optional':[{'DtlsSrtpKeyAgreement':true}]
};
var sdpConstraints = {};

var remoteUser = '';
function callerSuccess(mediaStream){
	localStream = mediaStream;
	localVideoElement.src = window.URL.createObjectURL(mediaStream);
	if(isChrome)
		pc = new webkitRTCPeerConnection(pc_config,pc_constraints);
	else
		pc = new mozRTCPeerConnection(pc_config,pc_constraints);
	console.log('Peer connection created '+pc);
	pc.addStream(mediaStream);
	
	pc.onaddstream = function(streamEvent){
		remoteStream = streamEvent.stream;
		console.log('Remote Stream: '+remoteStream);
		remoteVideoElement.src =  window.URL.createObjectURL(streamEvent.stream);
		$('#callStatus').html('Call in progress...');
	};
	pc.onicecandidate = function(e){
		var candidate = e.candidate;
		if(candidate){
			console.log('Caller Candidate Log: '+candidate);
			socket.emit('candidate',{targetUser:remoteUser, candidate:candidate});
		}
	};
	pc.createOffer(function(offerSDP){
		pc.setLocalDescription(offerSDP);
		console.log('Creating offer to remote user '+remoteUser);
		socket.emit('offersdp',{targetUser:remoteUser, offerSDP:offerSDP});
	},onfailure,sdpConstraints);
	function onfailure(e){
		alert('PC failed somewhat:'+e);
	}
};
function errorCallback(e){
	alert('Something wrong happened:'+e.toString());
}

//code for caller
$('#connect').on('click',function(){
	console.log('Trying to start a call. Current call started status :'+isStarted);
	if(!isStarted){
		remoteUser = $('#remoteUser').val();
		if(remoteUser != ''&&remoteUser != self){
			console.log('Call request from '+self+' to '+remoteUser);
			$('#video-chat').slideDown();
			$('#cover').fadeIn();
			$('#callStatus').html('Calling...Waiting for the remote user\'s response.');
			socket.emit('newVideoChatRequest',{sender:self,receiver:remoteUser},function(data){
				$('#remoteUser').val('');
				if(data.response){
					console.log('Your call was accepted!')
					$('#callStatus').html('Call accepted. Initiating video call now. Please, Allow Media Access to continue.');
					$('#video-chat').children('h3').css('background-color','#99CC00');
					if(navigator.getUserMedia){
						navigator.getUserMedia({video:true,audio:true},callerSuccess,errorCallback);
					}else
						$('#callStatus').html('Your browser does not support getUserMedia. Please update your broswer to use this app.');
					isStarted = true;
				}else{
					console.log('Your call request was either rejected or the user is busy');
					$('#callStatus').html('Call Failed. Reason: '+data.reason);
				}
				
			});
		}else
			alert('Please enter a valid remote user name');
	}else{
			$('#callStatus').html('You are already on a call');
	}
});
$('#cancelCall').on('click',function(e){ e.preventDefault();hangup(); });
socket.on('hangup',function(data){
	console.log('hangup request from '+data.reqSource+' to '+data.target);
	if(data.target == self && data.reqSource == remoteUser){
		console.log('Call hang up request to me!');
		remoteHangup();
	}
});

function hangup(){
	if(isStarted)
		socket.emit('hangup',{target:remoteUser,reqSource:self});
	remoteHangup();
}
function remoteHangup(){
	if(pc){
		pc.close(); 
		pc = null;
	}
	
	isStarted = false;
	remoteUser = '';
	localStream = null;
	remoteStream = null;
	$('#callStatus').html('Call ended!');
	$('#video-chat').slideUp('slow');
	$('#cover').fadeOut();
	if(remoteStream){
			remoteStream.stop();
	}
	if(localStream){
			localStream.stop();
	}
}
//Code for answerer!!



function gumInitiationForReceiver(){
	navigator.getUserMedia({video:true,audio:true},answererSuccess,errorCallback);
}
function answererSuccess(mediaStream){
	localStream = mediaStream;
	localVideoElement.src =  window.URL.createObjectURL(mediaStream);
	if(isChrome)
		pc = new webkitRTCPeerConnection(pc_config,pc_constraints);
	else
		pc = new mozRTCPeerConnection(pc_config,pc_constraints);
	console.log('Peer connection created '+pc);
	pc.addStream(mediaStream);
	pc.onaddstream = function(streamEvent){
		remoteStream = streamEvent.stream;
		console.log('Remote Media Stream: '+ remoteStream);
		remoteVideoElement.src =  window.URL.createObjectURL(streamEvent.stream);
		$('#callStatus').html('Call in progress...');
	};
	pc.onicecandidate = function(e){
		var candidate = e.candidate;
		if(candidate){
			socket.emit('candidate',{targetUser:remoteUser, candidate:candidate});
		}
	};
}
function createAnswer(offerSDP){
	//first set remote descriptions based on offerSDP
	if(isChrome)
		var remoteDescription = new RTCSessionDescription(offerSDP);
	else
		var remoteDescription = new mozRTCSessionDescription(offerSDP);
	pc.setRemoteDescription(remoteDescription);
	pc.createAnswer(function(answerSDP){
		pc.setLocalDescription(answerSDP);
		socket.emit('answersdp',{targetUser:remoteUser,answerSDP:answerSDP});
	},function(e){alert('something wrong happened :'+e);},sdpConstraints);
	
}
socket.on('newVideoCallRequest',function(data,callback){
console.log('New Video Call Request. Current call started status :'+isStarted);
if(!isStarted){
	$div = $('.callRequest');
	remoteUser = data.from;
	$div.find('#caller').text(remoteUser);
	$div.slideDown();
	$('#cover').fadeIn();
	$div.on('click','.green',function(){
		isStarted = true;
		callback({response:true,reason:'accepted'});
		$div.slideUp();
		$('#video-chat').slideDown();
		$('#video-chat').children('h3').css('background-color','#99CC00');
		$('#callStatus').html('Call accepted. Initiating video call now. Please, allow Media Access when asked for.');
		gumInitiationForReceiver();
		
	});
	$div.on('click','.red',function(){
		isStarted = false;
		callback({response:false,reason:'rejected'});
		$div.slideUp();
		$('#cover').fadeIn();
	});
}else{
	callback({response:false,reason:'busy'});	
}
});
//Handlers for sockets
socket.on('candidate',function(data){
	if(pc)
		if(isChrome)
			pc.addIceCandidate(new RTCIceCandidate(data.candidate));
		else
			pc.addIceCandidate(new mozRTCIceCandidate(data.candidate));
});
socket.on('offersdp',function(data){
	console.log(self+':: offer received. target user is ' + data.targetUser);
	if(data.targetUser == self && data.offerSDP){
		console.log('Receiver reaches here. Not the offerer.');
		createAnswer(data.offerSDP);
	}
});
socket.on('answersdp',function(data){
	if(data.targetUser == self && data.answerSDP){
		console.log('Offerer reaches here. Not the receiver.');
		if(isChrome)
			var remoteDescription = new RTCSessionDescription(data.answerSDP);
		else
			var remoteDescription = new mozRTCSessionDescription(data.answerSDP);
		pc.setRemoteDescription(remoteDescription);
	}
});
});