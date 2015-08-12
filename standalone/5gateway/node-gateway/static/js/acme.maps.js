namespace('acme.maps');
acme.maps.Initialize = function() {
	google.maps.Map2.prototype.addCrosshairs = acme.maps.AddCrosshairs;
	google.maps.Map2.prototype.removeCrosshairs = acme.maps.RemoveCrosshairs;
}
acme.maps.LANG_UNKNOWN = 0;
acme.maps.LANG_ENGLISH = 1;
acme.maps.LANG_FRENCH = 2;
acme.maps.currentLanguage = acme.maps.LANG_UNKNOWN;
acme.maps._mInstructions = null;
acme.maps.SetLanguage = function(language) {
	if (language != acme.maps.currentLanguage) {
		switch (language) {
		case acme.maps.LANG_ENGLISH:
			acme.maps._mInstructions = 'Drag the map with your mouse, or double-click to center.';
			_mSiteName = 'Google Maps';
			_mDataCopy = 'Map data &#169;2005 ';
			_mZenrinCopy = 'Map &#169;2005 ';
			_mNormalMap = 'Map';
			_mNormalMapShort = 'Map';
			_mHybridMap = 'Hybrid';
			_mHybridMapShort = 'Hyb';
			_mKeyholeMap = 'Satellite';
			_mKeyholeMapShort = 'Sat';
			_mNew = 'New!';
			_mTerms = 'Terms of Use';
			_mKeyholeCopy = 'Imagery &#169;2005 ';
			_mDecimalPoint = '.';
			_mThousandsSeparator = ',';
			_mZoomIn = 'Zoom In';
			_mZoomOut = 'Zoom Out';
			_mZoomSet = 'Click to set zoom level';
			_mZoomDrag = 'Drag to zoom';
			_mPanWest = 'Go left';
			_mPanEast = 'Go right';
			_mPanNorth = 'Go up';
			_mPanSouth = 'Go down';
			_mLastResult = 'Return to the last result';
			_mScale = 'Scale at the center of the map';
			break;
		case acme.maps.LANG_FRENCH:
			acme.maps._mInstructions = 'Faites glisser la carte avec la souris ou double-cliquez sur un point pour la recentrer.';
			_mSiteName = 'Cartes Google';
			_mDataCopy = 'Donn&eacute;es cartographiques &#169;2005 ';
			_mZenrinCopy = 'Carte &#169;2005 ';
			_mNormalMap = 'Carte';
			_mNormalMapShort = 'Car';
			_mHybridMap = 'Mixte';
			_mHybridMapShort = 'Mix';
			_mKeyholeMap = 'Satellite';
			_mKeyholeMapShort = 'Sat';
			_mNew = 'Nouvelle!';
			_mTerms = 'Limites d\'utilisation';
			_mKeyholeCopy = 'Images &#169;2005 ';
			_mDecimalPoint = ',';
			_mThousandsSeparator = '.';
			_mZoomIn = 'Zoom avant';
			_mZoomOut = 'Zoom arri&egrave;re';
			_mZoomSet = 'Cliquez pour d&eacute;finir le facteur de zoom';
			_mZoomDrag = 'Faites glisser le curseur pour zoomer';
			_mPanWest = 'D&eacute;placer vers la gauche';
			_mPanEast = 'D&eacute;placer vers la droite';
			_mPanNorth = 'D&eacute;placer vers le haut';
			_mPanSouth = 'D&eacute;placer vers le bas';
			_mLastResult = 'Revenir au r&eacute;sultat pr&eacute;c&eacute;dent';
			_mScale = '&Eacute;chelle au centre de la carte';
			break;
		}
		_mZoomIn = acme.utils.EntityToIso8859(_mZoomIn);
		_mZoomOut = acme.utils.EntityToIso8859(_mZoomOut);
		_mZoomSet = acme.utils.EntityToIso8859(_mZoomSet);
		_mZoomDrag = acme.utils.EntityToIso8859(_mZoomDrag);
		_mPanWest = acme.utils.EntityToIso8859(_mPanWest);
		_mPanEast = acme.utils.EntityToIso8859(_mPanEast);
		_mPanNorth = acme.utils.EntityToIso8859(_mPanNorth);
		_mPanSouth = acme.utils.EntityToIso8859(_mPanSouth);
		_mLastResult = acme.utils.EntityToIso8859(_mLastResult);
		_mScale = acme.utils.EntityToIso8859(_mScale);
		acme.maps.currentLanguage = language;
	}
}
acme.maps.pztCookieName = 'positionZoomType';
acme.maps.SavePositionZoomTypeCookie = function(map) {
	var mapCenter = map.getCenter();
	var mapZoom = map.getZoom();
	var mapTypeLetter = acme.maps.MapTypeToLetter(map.getCurrentMapType());
	var cookieValue = mapCenter.lat().toFixed(5) + ','
			+ mapCenter.lng().toFixed(5) + ',' + mapZoom + ',' + mapTypeLetter;
	acme.utils.SaveCookie(acme.maps.pztCookieName, cookieValue);
}
acme.maps.GetPositionZoomTypeCookie = function(map) {
	var cookieValue = acme.utils.GetCookie(acme.maps.pztCookieName);
	if (cookieValue == null)
		return false;
	var vals = cookieValue.split(',');
	if (vals.length != 4)
		return false;
	var mapY = parseFloat(vals[0]);
	var mapX = parseFloat(vals[1]);
	var mapZoomStr = vals[2];
	var mapTypeLetter = vals[3];
	var mapZoom = parseInt(mapZoomStr);
	map.setCenter(new google.maps.LatLng(mapY, mapX), mapZoom);
	map.setMapType(acme.maps.LetterToMapType(mapTypeLetter));
	return true;
}
acme.maps.SavePositionZoomTypeCookieOnChanges = function(map) {
	var caller = acme.utils.MakeCaller(acme.maps.SavePositionZoomTypeCookie,
			map);
	google.maps.Event.addListener(map, 'moveend', caller);
	google.maps.Event.addListener(map, 'zoomend', caller);
	google.maps.Event.addListener(map, 'maptypechanged', caller);
}
acme.maps.MapTypeToLetter = function(mapType) {
	switch (mapType) {
	case google.maps.NORMAL_MAP:
		return 'M';
	case google.maps.SATELLITE_MAP:
		return 'S';
	case google.maps.HYBRID_MAP:
		return 'H';
	case google.maps.PHYSICAL_MAP:
		return 'R';
	case acme.maps.maptypes.USATOPO_MAP:
		return 'T';
	case acme.maps.maptypes.DOQ_MAP:
		return 'O';
	case acme.maps.maptypes.NEXRAD_MAP:
		return 'N';
	case acme.maps.maptypes.MAPNIK_MAP:
		return 'K';
	default:
		return '-';
	}
}
acme.maps.LetterToMapType = function(letter) {
	switch (letter) {
	case 'M':
		return google.maps.NORMAL_MAP;
	case 'S':
		return google.maps.SATELLITE_MAP;
	case 'H':
		return google.maps.HYBRID_MAP;
	case 'R':
		return google.maps.PHYSICAL_MAP;
	case 'T':
		return acme.maps.maptypes.USATOPO_MAP;
	case 'O':
		return acme.maps.maptypes.DOQ_MAP;
	case 'N':
		return acme.maps.maptypes.NEXRAD_MAP;
	case 'K':
		return acme.maps.maptypes.MAPNIK_MAP;
	default:
		return null;
	}
}
acme.maps.degreesPerRadian = 180.0 / Math.PI;
acme.maps.radiansPerDegree = Math.PI / 180.0;
acme.maps.Bearing = function(from, to) {
	var lat1 = from.lat() * acme.maps.radiansPerDegree;
	var lon1 = from.lng() * acme.maps.radiansPerDegree;
	var lat2 = to.lat() * acme.maps.radiansPerDegree;
	var lon2 = to.lng() * acme.maps.radiansPerDegree;
	var angle = -Math.atan2(Math.sin(lon1 - lon2) * Math.cos(lat2), Math
			.cos(lat1)
			* Math.sin(lat2)
			- Math.sin(lat1)
			* Math.cos(lat2)
			* Math.cos(lon1 - lon2));
	if (angle < 0.0)
		angle += Math.PI * 2.0;
	angle = angle * acme.maps.degreesPerRadian;
	return angle;
}
acme.maps.BadBearing = function(from, to) {
	var a = from.lat();
	var b = to.lat();
	var l = to.lng() - from.lng();
	var episilon = 0.0000000001;
	if (Math.abs(l) <= episilon)
		if (a > b)
			return 180.0;
		else
			return 0.0;
	else if (Math.abs(Math.abs(l) - 180.0) <= episilon)
		if (a >= 0.0 && b >= 0.0)
			return 0.0;
		else if (a < 0.0 && b < 0.0)
			return 180.0;
		else if (a >= 0.0)
			if (a > -b)
				return 0.0;
			else
				return 180.0;
		else if (a > -b)
			return 180.0;
		else
			return 0.0;
	a *= acme.maps.radiansPerDegree;
	b *= acme.maps.radiansPerDegree;
	l *= acme.maps.radiansPerDegree;
	var d = Math.acos(Math.sin(a) * Math.sin(b) + Math.cos(a) * Math.cos(b)
			* Math.cos(l));
	var angle = Math.acos((Math.sin(b) - Math.sin(a) * Math.cos(d))
			/ (Math.cos(a) * Math.sin(d)));
	angle = angle * acme.maps.degreesPerRadian;
	if (Math.sin(l) < 0)
		angle = 360.0 - angle;
	return angle;
}
acme.maps.Direction = function(bearing) {
	if (bearing >= 348.75 || bearing < 11.25)
		return "N";
	if (bearing >= 11.25 && bearing < 33.75)
		return "NxNE";
	if (bearing >= 33.75 && bearing < 56.25)
		return "NE";
	if (bearing >= 56.25 && bearing < 78.75)
		return "ExNE";
	if (bearing >= 78.75 && bearing < 101.25)
		return "E";
	if (bearing >= 101.25 && bearing < 123.75)
		return "ExSE";
	if (bearing >= 123.75 && bearing < 146.25)
		return "SE";
	if (bearing >= 146.25 && bearing < 168.75)
		return "SxSE";
	if (bearing >= 168.75 && bearing < 191.25)
		return "S";
	if (bearing >= 191.25 && bearing < 213.75)
		return "SxSW";
	if (bearing >= 213.75 && bearing < 236.25)
		return "SW";
	if (bearing >= 236.25 && bearing < 258.75)
		return "WxSW";
	if (bearing >= 258.75 && bearing < 281.25)
		return "W";
	if (bearing >= 281.25 && bearing < 303.75)
		return "WxNW";
	if (bearing >= 303.75 && bearing < 326.25)
		return "NW";
	if (bearing >= 326.25 && bearing < 348.75)
		return "NxNW";
	return "???"
}
acme.maps.Direction8 = function(bearing) {
	if (bearing >= 337.5 || bearing < 22.5)
		return "N";
	if (bearing >= 22.5 && bearing < 67.5)
		return "NE";
	if (bearing >= 67.5 && bearing < 112.5)
		return "E";
	if (bearing >= 112.5 && bearing < 157.5)
		return "SE";
	if (bearing >= 157.5 && bearing < 202.5)
		return "S";
	if (bearing >= 202.5 && bearing < 247.5)
		return "SW";
	if (bearing >= 247.5 && bearing < 292.5)
		return "W";
	if (bearing >= 292.5 && bearing < 337.5)
		return "NW";
	return "???"
}
acme.maps.clickZoomMap = null;
acme.maps.clickZoomListener;
acme.maps.clickZoomClicked;
acme.maps.clickZoomDoubleClicked;
acme.maps.ClickZoom = function(map) {
	if (map == acme.maps.clickZoomMap)
		return;
	if (acme.maps.clickZoomMap != null)
		acme.maps.ClickZoomOff();
	acme.maps.clickZoomMap = map;
	acme.maps.clickZoomListener = google.maps.Event.addListener(
			acme.maps.clickZoomMap, 'click', acme.maps.ClickZoomClickHandler);
	acme.maps.clickZoomClicked = false;
	acme.maps.clickZoomDoubleClicked = false;
}
acme.maps.ClickZoomOff = function() {
	if (acme.maps.clickZoomMap != null) {
		google.maps.Event.removeListener(acme.maps.clickZoomListener);
		acme.maps.clickZoomListener = null;
		acme.maps.clickZoomMap = null;
	}
}
acme.maps.ClickZoomClickHandler = function(overlay, point) {
	if (overlay == null && point != null) {
		if (acme.maps.clickZoomClicked)
			acme.maps.clickZoomDoubleClicked = true;
		else {
			acme.maps.clickZoomClicked = true;
			acme.maps.clickZoomDoubleClicked = false;
			setTimeout(acme.utils.MakeCaller(acme.maps.ClickZoomLaterHandler,
					point), 250);
		}
	}
}
acme.maps.ClickZoomLaterHandler = function(point) {
	if (!acme.maps.clickZoomDoubleClicked)
		acme.maps.clickZoomMap.setCenter(point, acme.maps.clickZoomMap
				.getZoom() + 1);
	acme.maps.clickZoomClicked = false;
}
acme.maps.mouseWheelZoomMap = null;
acme.maps.MouseWheelZoom = function(map) {
	if (map == acme.maps.mouseWheelZoomMap)
		return;
	if (acme.maps.mouseWheelZoomMap != null)
		acme.maps.MouseWheelZoomOff();
	acme.maps.mouseWheelZoomMap = map;
	acme.maps.MouseWheelZoomListen(map.getContainer());
}
acme.maps.MouseWheelZoomListen = function(container) {
	if (container.addEventListener)
		container.addEventListener('DOMMouseScroll',
				acme.maps.MouseWheelZoomHandler, false);
	else
		container.onmousewheel = window.onmousewheel = document.onmousewheel = acme.maps.MouseWheelZoomHandler;
}
acme.maps.MouseWheelZoomOff = function() {
	if (acme.maps.mouseWheelZoomMap != null) {
		var container = acme.maps.mouseWheelZoomMap.getContainer();
		if (container.removeEventListener)
			container.removeEventListener('DOMMouseScroll',
					acme.maps.MouseWheelZoomHandler, false);
		else
			container.onmousewheel = window.onmousewheel = document.onmousewheel = null;
		acme.maps.mouseWheelZoomMap = null;
	}
}
acme.maps.MouseWheelZoomHandler = function(e) {
	e = acme.utils.GetEvent(e);
	if (e != null) {
		var data = 0;
		if (e.detail != null)
			data = -e.detail;
		else if (e.wheelDelta != null)
			data = e.wheelDelta
		else if (e.wheelData != null) {
			data = e.wheelData
			if (window.opera)
				data = -data;
		}
		if (data > 0)
			acme.maps.mouseWheelZoomMap.setZoom(acme.maps.mouseWheelZoomMap
					.getZoom() + 1);
		else if (data < 0)
			acme.maps.mouseWheelZoomMap.setZoom(acme.maps.mouseWheelZoomMap
					.getZoom() - 1);
	}
}
acme.maps.GetLatLngFromIP = function() {
	var request = acme.utils.CreateXMLHttpRequest();
	if (request == null)
		return null;
	request.open('GET', '/resources/hostip_proxy.cgi', false);
	request.send(null);
	if (request.readyState != 4)
		return null;
	if (request.status != 200)
		return null;
	if (request.responseXML == null)
		return null;
	if (request.responseXML.documentElement == null)
		return null;
	var coordElement = acme.utils.FindDeepChildNamed(
			request.responseXML.documentElement, 'gml:coordinates');
	if (coordElement == null)
		return null;
	var coordText = acme.utils.GetXmlText(coordElement);
	var coords = coordText.split(',');
	if (coords.length != 2)
		return null;
	var lng = parseFloat(coords[0]);
	var lat = parseFloat(coords[1]);
	return new google.maps.LatLng(lat, lng);
}
acme.maps.ZoomToMarkers = function(map, markers) {
	if (markers.length == 0)
		return;
	var minLng = 9999.0, maxLng = -9999.0, minLat = 9999.0, maxLat = -9999.0;
	for ( var i in markers) {
		if (markers[i].getPoint().lng() < minLng)
			minLng = markers[i].getPoint().lng();
		if (markers[i].getPoint().lng() > maxLng)
			maxLng = markers[i].getPoint().lng();
		if (markers[i].getPoint().lat() < minLat)
			minLat = markers[i].getPoint().lat();
		if (markers[i].getPoint().lat() > maxLat)
			maxLat = markers[i].getPoint().lat();
	}
	var center = new google.maps.LatLng((minLat + maxLat) / 2.0,
			(minLng + maxLng) / 2.0);
	map.setCenter(center);
	var bounds = new google.maps.LatLngBounds(new google.maps.LatLng(minLat,
			minLng), new google.maps.LatLng(maxLat, maxLng));
	map.setZoom(map.getBoundsZoomLevel(bounds));
}
acme.maps.crosshairsSize = 19;
acme.maps.AddCrosshairs = function() {
	var container = this.getContainer();
	if (this.crosshairs)
		this.removeCrosshairs();
	var crosshairs = document.createElement("img");
	crosshairs.src = 'http://acme.com/resources/images/crosshairs.gif';
	crosshairs.style.width = acme.maps.crosshairsSize + 'px';
	crosshairs.style.height = acme.maps.crosshairsSize + 'px';
	crosshairs.style.border = '0';
	crosshairs.style.position = 'relative';
	crosshairs.style.top = ((container.clientHeight - acme.maps.crosshairsSize) / 2)
			+ 'px';
	crosshairs.style.left = ((container.clientWidth - acme.maps.crosshairsSize) / 2)
			+ 'px';
	crosshairs.style.zIndex = '500';
	container.appendChild(crosshairs);
	this.crosshairs = crosshairs;
	return crosshairs;
};
acme.maps.RemoveCrosshairs = function() {
	if (this.crosshairs) {
		this.getContainer().removeChild(this.crosshairs);
		this.crosshairs = null;
	}
};