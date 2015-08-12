/* Foundation v2.1.5 http://foundation.zurb.com */
$(document).ready(function () {

	/* Use this js doc for all application specific JS */

	/* TABS --------------------------------- */
	/* Remove if you don't need :) */

	function activateTab($tab) {
		var $activeTab = $tab.closest('dl').find('a.active'),
				contentLocation = $tab.attr("href") + 'Tab';

		//Make Tab Active
		$activeTab.removeClass('active');
		$tab.addClass('active');

    	//Show Tab Content
		$(contentLocation).closest('.tabs-content').children('li').hide();
		$(contentLocation).show();
	}

	$('dl.tabs').each(function () {
		//Get all tabs
		var tabs = $(this).children('dd').children('a');
		tabs.click(function (e) {
			activateTab($(this));
		});
	});

	if (window.location.hash) {
		activateTab($('a[href="' + window.location.hash + '"]'));
	}

	/* ALERT BOXES ------------ */
	$(".alert-box").delegate("a.close", "click", function(event) {
    event.preventDefault();
	  $(this).closest(".alert-box").fadeOut(function(event){
	    $(this).remove();
	  });
	});


	/* PLACEHOLDER FOR FORMS ------------- */
	/* Remove this and jquery.placeholder.min.js if you don't need :) */

	$('input, textarea').placeholder();



	/* UNCOMMENT THE LINE YOU WANT BELOW IF YOU WANT IE6/7/8 SUPPORT AND ARE USING .block-grids */
//	$('.block-grid.two-up>li:nth-child(2n+1)').css({clear: 'left'});
//	$('.block-grid.three-up>li:nth-child(3n+1)').css({clear: 'left'});
//	$('.block-grid.four-up>li:nth-child(4n+1)').css({clear: 'left'});
//	$('.block-grid.five-up>li:nth-child(5n+1)').css({clear: 'left'});



	/* DROPDOWN NAV ------------- */

	var lockNavBar = false;
	$('.nav-bar a.flyout-toggle').live('click', function(e) {
		e.preventDefault();
		var flyout = $(this).siblings('.flyout');
		if (lockNavBar === false) {
			$('.nav-bar .flyout').not(flyout).slideUp(500);
			flyout.slideToggle(500, function(){
				lockNavBar = false;
			});
		}
		lockNavBar = true;
	});
  if (Modernizr.touch) {
    $('.nav-bar>li.has-flyout>a.main').css({
      'padding-right' : '75px',
    });
    $('.nav-bar>li.has-flyout>a.flyout-toggle').css({
      'border-left' : '1px dashed #eee'
    });
  } else {
    $('.nav-bar>li.has-flyout').hover(function() {
      $(this).children('.flyout').show();
    }, function() {
      $(this).children('.flyout').hide();
    })
  }


	/* DISABLED BUTTONS ------------- */
	/* Gives elements with a class of 'disabled' a return: false; */

  
  
  	if (Function.prototype.method !== 'function') {
  		Function.prototype.method = function(name, func) {
  			if (!this.prototype[name]) {
  				this.prototype[name] = func;
  	  			return this;
  			}
  		};
  	}
  	
  	Function.method('inherits', function(Parent) {
  		this.prototype = new Parent();
  		return this;
  	});

  
	$("#divMammal").append('<div>Creating Mammal...</div>');
	var Mammal = function(name) {
		this.name = name;
	};
	
	Mammal.prototype.get_name = function() {
		return this.name;
	};
	
	Mammal.prototype.says = function() {
		return this.saying || '';
	};
	
	var myMammal = new Mammal('Herb the Mammal');
	var name = myMammal.get_name();
	
	$("#divMammal").append('<div>Creating Cat...</div>');
	var Cat = function(name) {
		this.name = name;
		this.saying = 'meow';
	}.
		inherits(Mammal).
		method('purr', function (n) {
			var i, s = '';
			for(i = 0; i < n; i += 1) {
				if (s) {
					s +='-';
				}
				s += 'r';
			}
			return s;
		}).
		method('get_name', function () {
			return this.says() + ' ' + this.name + ' ' + this.says();
		});
	$("#divMammal").append('<div>Cat Created...</div>');
	
/*	Cat.prototype = new Mammal();
	Cat.prototype.purr = function(n) {
		var i, s = '';
		for(i = 0; i < n; i += 1) {
			if (s) {
				s +='-';
			}
			s += 'r';
		}
		return s;
	};
	
	Cat.prototype.get_name = function() {
		return this.says() + ' ' + this.name + ' ' + this.says();
	};*/
	
	var bdo = Object.create(ModelBaseDataObject);
	//alert('BDO.cn: ' + bdo.cn);
	
	var strawberry = Object.create(ModelCropType);
	//alert('CropType.cn: ' + strawberry.cn);
	//alert('Strawberry: ' + strawberry.get_name());
	strawberry.set_name('Strawberry');
	//alert('Strawberry: ' + strawberry.get_name());
	
/**	strawberry.save(
			function(result, token) {
				alert('Strawberry saved!');
			},
			function(fault, token) {
				alert('Strawberry NOT saved b/c: ' + fault);
			}
	);**/
	
	setupSyncAgent();
	syncAgent.getRegAppOAuths('test', 'test123', 'WEB', function(result) {
		$("#divLoginSvcOAuths").show();
		for ( var i = 0; i < result.length; i++) {
			//result[i]
			$("#divLoginSvcOAuths").append('<button onclick="loginClick(\'' + result[i].appKey + '\',\'http://localhost:8080/testjs.html\')">Login via ' + result[i].serviceApplication.serviceProvider.name + '</button>');
		}

		// Check to see if there is a code in the url.
		if ($.urlParam('code')) {
			$('#status').text('Logging in...');
			$('#status').css('color', 'yellow');
//			$("#divLoginSvcOAuths :button").disable();

			syncAgent.login('test', result[0].appKey, $.urlParam('code'), 'http://localhost:8080/testjs.html', function(result) {
//				$("#divLoginSvcOAuths :button").enable();
				if (result
						&& result.clientId
						&& result.user
						&& result.user.id) {
					setStatus(true);
				} else {
					alert('Invalid login result');
					setStatus(false);
				}
			}, function(fault) {
//				$("#divLoginSvcOAuths :button").enable();
				alert('Error logging in...');
				setStatus(false);
			});
		}
	});
	
/**	syncAgent.findById('com.psiglobal.mo.CropType', '402882c23443de6f013443df43c60027', function(result, token) {
		alert('Got findByIdResult!');
	},
	function(fault, token) {
		alert('FindById Fault: ' + fault);
	});*/
	
/*	var myCat = new Cat('Henrietta');
	var says = myCat.says();
	var purr = myCat.purr(5);
	var name = myCat.get_name();
	
	//$("#divMammal").empty();
	$("#divMammal").append('<div>' + name + '</div>');
	//alert(name);*/
	

});

function setStatus(inout) {
	if (inout) {
		$('#status').text('Logged In');
		$('#status').css('color', 'green');
		$("#divLoginSvcOAuths").hide();
	} else {
		$('#status').text('Logged Out');
		$('#status').css('color', 'red');
		$("#divLoginSvcOAuths").show();
	}
}

function loginClick(appKey, redirectUri) {
	var clientId = "";//"718060161923-it8br814fca5bhqg6qfagmnch32hntj3.apps.googleusercontent.com";
	if (appKey)
		clientId = appKey;
	var redirectURL = "";//"http://localhost:8080/testjs.html";
	if (redirectUri)
		redirectURL = redirectUri;

	window.location = "https://accounts.google.com/o/oauth2/auth?client_id="
			+ clientId
			+ "&access_type=offline&redirect_uri="
			+ redirectURL
			+ "&response_type=code&scope=https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/userinfo.email%20http://www.google.com/m8/feeds%20https://apps-apis.google.com/a/feeds/groups/";
	//  "https://accounts.google.com/o/oauth2/auth?client_id=" + clientId + "&access_type=offline&redirect_uri="+redirectURL+"&response_type=code&scope=https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/userinfo.email";
	//                	 https://accounts.google.com/o/oauth2/auth?client_id=764241383146.apps.googleusercontent.com&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/userinfo.email%20http://www.google.com/m8/feeds%20https://apps-apis.google.com/a/feeds/groups/
}

function getCrop() {
	//alert('getCrop');
//	syncAgent.findById('com.psiglobal.mo.CropType', '402882c23443de6f013443df43c60027', function(result, token) {
	syncAgent.findById('com.psiglobal.mo.CropType', '402882c23443de6f013443df13ff0024', function(result, token) {
		$("#divCropType").append('<div>' + result.name + '</div>');
	},
	function(fault, token) {
		alert('FindById Fault: ' + fault);
	});
	console.log('Get Crop');
}