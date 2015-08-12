google.load("maps", "2", {
	other_params : "sensor=false"
});
google.setOnLoadCallback(Setup);
var instructionsDiv = document.getElementById('instructions');
var mapDiv = document.getElementById('map');
var areaDiv = document.getElementById('area');
var pedometerItem = document.getElementById('pedometer');
var map;
var points = [];
var markers = [];
var lines = [];
var polygonPoints = [];
var polygon = null;
var lineWidth = 5;
var lineColor = '#ff0000';
var closerColor = '#0000ff';
var fillColor = '#009900';
var redIcon, blueIcon;
function Setup() {
	try {
		acme.maps.Initialize();
		acme.maps.maptypes.Initialize();
		if (!google.maps.BrowserIsCompatible()) {
			mapDiv.innerHTML = 'Sorry, your browser is not compatible with Google Maps.';
			return;
		}
		map = new google.maps.Map2(mapDiv, {
			draggableCursor : 'default'
		});
		map.addControl(new google.maps.LargeMapControl());
		map.addMapType(acme.maps.maptypes.USATOPO_MAP);
		map.addMapType(acme.maps.maptypes.DOQ_MAP);
		map.addMapType(acme.maps.maptypes.MAPNIK_MAP);
		map.addControl(new google.maps.MapTypeControl());
		map.addControl(new google.maps.ScaleControl());
		google.maps.Event.addListener(map, 'click', MapClick);
		acme.maps.SavePositionZoomTypeCookieOnChanges(map);
		if (!acme.maps.GetPositionZoomTypeCookie(map)) {
			var point = acme.maps.GetLatLngFromIP();
			if (point != null)
				map.setCenter(point, 9);
			else
				map.setCenter(new google.maps.LatLng(0.0, 0.0), 1);
		}
		map.setMapType(google.maps.NORMAL_MAP);
		google.maps.Event.addListener(map, 'moveend', UpdatePedometerLink);
		google.maps.Event.addListener(map, 'zoomend', UpdatePedometerLink);
		google.maps.Event.addListener(map, 'maptypechanged',
				UpdatePedometerLink);
		UpdatePedometerLink();
		redIcon = new google.maps.Icon(google.maps.DEFAULT_ICON);
		redIcon.image = 'http://acme.com/resources/images/markers/red.PNG';
		redIcon.shadow = 'http://acme.com/resources/images/markers/shadow.PNG';
		redIcon.iconSize = new google.maps.Size(20, 34);
		redIcon.shadowSize = new google.maps.Size(37, 34);
		redIcon.iconAnchor = new google.maps.Point(9, 34);
		redIcon.infoWindowAnchor = new google.maps.Point(9, 2);
		redIcon.infoShadowAnchor = new google.maps.Point(18, 25);
		blueIcon = new google.maps.Icon(redIcon);
		blueIcon.image = 'http://acme.com/resources/images/markers/blue.PNG';
		Display();
	} catch (e) {
		google.maps.Log.write('Setup:\n' + acme.utils.Props(e));
	}
}
function UpdatePedometerLink() {
	var mapCenter = map.getCenter();
	var mapZoom = map.getZoom();
	var mapTypeLetter = acme.maps.MapTypeToLetter(map.getCurrentMapType());
	mapTypeLetter = mapTypeLetter.toLowerCase();
	pedometerItem.innerHTML = '<a href="http://www.gmap-pedometer.com/?centerX='
			+ mapCenter.lng()
			+ '&centerY='
			+ mapCenter.lat()
			+ '&zl='
			+ mapZoom + '&fl=' + mapTypeLetter + '">Gmaps Pedometer</a><br />';
}
function Display() {
	for ( var i = 0; i < markers.length; ++i)
		map.removeOverlay(markers[i]);
	markers = [];
	for ( var i = 0; i < lines.length; ++i)
		map.removeOverlay(lines[i]);
	lines = [];
	polygonPoints = [];
	if (polygon != null) {
		map.removeOverlay(polygon);
		polygon = null;
	}
	for ( var i = 0; i < points.length; ++i) {
		var marker = new google.maps.Marker(points[i], {
			icon : i == points.length - 1 ? blueIcon : redIcon
		});
		markers.push(marker);
		map.addOverlay(marker);
		google.maps.Event.addListener(marker, 'click', acme.utils.MakeCaller(
				MarkerClick, i));
		if (i > 0 && points.length >= 3)
			AddPolylines(lines, GreatCirclePoints(points[i - 1], points[i]),
					lineColor, lineWidth);
	}
	if (points.length >= 2)
		AddPolylines(lines, GreatCirclePoints(points[points.length - 1],
				points[0]), closerColor, lineWidth);
	if (points.length >= 3) {
	}
	var smallFontOpen = '<font size="-1">';
	var fontClose = '</font>';
	var mapInst = 'Drag the map with your mouse, or double-click to center.';
	var clickInst = 'Click on the map to place points.';
	var html = smallFontOpen + mapInst + '<p>' + clickInst;
	areaDiv.innerHTML = '&nbsp;';
	if (points.length <= 2)
		html += '<p>Once you have placed at least three points, the enclosed area will be computed.';
	else {
		html += '<p>The enclosed area is shown below.';
		var areaMeters2 = SphericalPolygonAreaMeters2(points);
		if (areaMeters2 < 1000000.0)
			areaMeters2 = PlanarPolygonAreaMeters2(points);
		areaDiv.innerHTML = smallFontOpen + Areas(areaMeters2) + fontClose;
	}
	html += fontClose;
	instructionsDiv.innerHTML = html;
}
function AddPolylines(lines, ps, lineColor, lineWidth) {
	var line = new google.maps.Polyline(ps, lineColor, lineWidth);
	lines.push(line);
	map.addOverlay(line);
	for ( var i = 0; i < ps.length; ++i)
		polygonPoints.push(ps[i]);
}
var metersPerKm = 1000.0;
var meters2PerHectare = 10000.0;
var feetPerMeter = 3.2808399;
var feetPerMile = 5280.0;
var acresPerMile2 = 640;
function Areas(areaMeters2) {
	var areaHectares = areaMeters2 / meters2PerHectare;
	var areaKm2 = areaMeters2 / metersPerKm / metersPerKm;
	var areaFeet2 = areaMeters2 * feetPerMeter * feetPerMeter;
	var areaMiles2 = areaFeet2 / feetPerMile / feetPerMile;
	var areaAcres = areaMiles2 * acresPerMile2;
	return areaMeters2.toPrecision(4) + ' m&sup2; / '
			+ areaHectares.toPrecision(4) + ' hectares / '
			+ areaKm2.toPrecision(4) + ' km&sup2; / '
			+ areaFeet2.toPrecision(4) + ' ft&sup2; / '
			+ areaAcres.toPrecision(4) + ' acres / '
			+ areaMiles2.toPrecision(4) + ' mile&sup2;';
}
var earthRadiusMeters = 6367460.0;
var metersPerDegree = 2.0 * Math.PI * earthRadiusMeters / 360.0;
function GreatCirclePoints(p1, p2) {
	var maxDistanceMeters = 200000.0;
	var ps = [];
	if (p1.distanceFrom(p2) <= maxDistanceMeters) {
		ps.push(p1);
		ps.push(p2);
	} else {
		var theta1 = p1.lng() * acme.maps.radiansPerDegree;
		var phi1 = (90.0 - p1.lat()) * acme.maps.radiansPerDegree;
		var x1 = earthRadiusMeters * Math.cos(theta1) * Math.sin(phi1);
		var y1 = earthRadiusMeters * Math.sin(theta1) * Math.sin(phi1);
		var z1 = earthRadiusMeters * Math.cos(phi1);
		var theta2 = p2.lng() * acme.maps.radiansPerDegree;
		var phi2 = (90.0 - p2.lat()) * acme.maps.radiansPerDegree;
		var x2 = earthRadiusMeters * Math.cos(theta2) * Math.sin(phi2);
		var y2 = earthRadiusMeters * Math.sin(theta2) * Math.sin(phi2);
		var z2 = earthRadiusMeters * Math.cos(phi2);
		var x3 = (x1 + x2) / 2.0;
		var y3 = (y1 + y2) / 2.0;
		var z3 = (z1 + z2) / 2.0;
		var r3 = Math.sqrt(x3 * x3 + y3 * y3 + z3 * z3);
		var theta3 = Math.atan2(y3, x3);
		var phi3 = Math.acos(z3 / r3);
		var p3 = new google.maps.LatLng(90.0 - phi3
				* acme.maps.degreesPerRadian, theta3
				* acme.maps.degreesPerRadian);
		var s1 = GreatCirclePoints(p1, p3);
		var s2 = GreatCirclePoints(p3, p2);
		for ( var i = 0; i < s1.length; ++i)
			ps.push(s1[i]);
		for ( var i = 1; i < s2.length; ++i)
			ps.push(s2[i]);
	}
	return ps;
}
function PlanarPolygonAreaMeters2(points) {
	var a = 0.0;
	for ( var i = 0; i < points.length; ++i) {
		var j = (i + 1) % points.length;
		var xi = points[i].lng() * metersPerDegree
				* Math.cos(points[i].lat() * acme.maps.radiansPerDegree);
		var yi = points[i].lat() * metersPerDegree;
		var xj = points[j].lng() * metersPerDegree
				* Math.cos(points[j].lat() * acme.maps.radiansPerDegree);
		var yj = points[j].lat() * metersPerDegree;
		a += xi * yj - xj * yi;
	}
	return Math.abs(a / 2.0);
}
function SphericalPolygonAreaMeters2(points) {
	var totalAngle = 0.0;
	for (i = 0; i < points.length; ++i) {
		var j = (i + 1) % points.length;
		var k = (i + 2) % points.length;
		totalAngle += Angle(points[i], points[j], points[k]);
	}
	var planarTotalAngle = (points.length - 2) * 180.0;
	var sphericalExcess = totalAngle - planarTotalAngle;
	if (sphericalExcess > 420.0) {
		totalAngle = points.length * 360.0 - totalAngle;
		sphericalExcess = totalAngle - planarTotalAngle;
	} else if (sphericalExcess > 300.0 && sphericalExcess < 420.0) {
		sphericalExcess = Math.abs(360.0 - sphericalExcess);
	}
	return sphericalExcess * acme.maps.radiansPerDegree * earthRadiusMeters
			* earthRadiusMeters;
}
function Angle(p1, p2, p3) {
	var bearing21 = acme.maps.Bearing(p2, p1);
	var bearing23 = acme.maps.Bearing(p2, p3);
	var angle = bearing21 - bearing23;
	if (angle < 0.0)
		angle += 360.0;
	return angle;
}
var clicked = false, doubleClicked;
function MapClick(overlay, point) {
	try {
		if (overlay == null && point != null) {
			if (clicked)
				doubleClicked = true;
			else {
				clicked = true;
				doubleClicked = false;
				setTimeout(acme.utils.MakeCaller(MapClickLater, point), 250);
			}
		}
	} catch (e) {
		google.maps.Log.write('MapClick:\n' + acme.utils.Props(e));
	}
}
function MapClickLater(point) {
	try {
		if (!doubleClicked) {
			points.push(point);
			Display();
		}
		clicked = false;
	} catch (e) {
		google.maps.Log.write('MapClickLater:\n' + acme.utils.Props(e));
	}
}
function MarkerClick(pointIndex) {
	try {
		RotatePoints(pointIndex + 1);
		Display();
	} catch (e) {
		google.maps.Log.write('MarkerClick:\n' + acme.utils.Props(e));
	}
}
function RotatePoints(n) {
	var t = [];
	for ( var i = 0; i < points.length; ++i)
		t.push(points[(i + n) % points.length]);
	points = t;
}
function DeleteLastPoint() {
	if (points.length > 0)
		points.length--;
	Display();
}
function ClearAllPoints() {
	points = [];
	Display();
}