var connect = require('connect')
  , http = require('http')
  , server
  , sys = require('util')
  ;

// visit form.html

var app = connect()
  .use(connect.static(__dirname + '/static'))
  .use(connect.bodyParser())
  .use(function(req, res, next){
    if ('GET' != req.method) {
    	sys.puts(sys.inspect(req));
    	return next();
    }
    res.statusCode = 302;
    res.setHeader('Location', 'form.html');
    res.end();
  })
  .use(function(req, res){
    res.setHeader('Content-Type', 'text/html');
    res.write('<p>thanks ' + req.body.name + '</p>');
    res.write('<ul>');

    if (Array.isArray(req.files.images)) {
      req.files.images.forEach(function(image){
        var kb = image.size / 1024 | 0;
        res.write('<li>uploaded ' + image.name + ' ' + kb + 'kb</li>');
      });
    } else {
      var image = req.files.images;
      var kb = image.size / 1024 | 0;
      res.write('<li>uploaded ' + image.name + ' ' + kb + 'kb</li>');
    }

    res.end('</ul>');
  });

//server = connect(app);
app.listen(3000);

//server.listen(3000);
//http.Server(app).listen(3000);
console.log('Server started on port 3000');