require('dotenv').config();
const express = require('express');
const session = require("express-session");
const passport = require("passport");
const { Strategy } = require("passport-local");
const LocalStrategy = Strategy;
const exphbs  = require('express-handlebars');
const User  = require('./src/models/User.js');
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { Server: HttpServer } = require("http");
const { report } = require("node:process");

const ramdomsRoutes = require('./api/routes/randoms');

mongoose
  .connect("mongodb+srv://test:123456alon@cluster0.piknkma.mongodb.net/?retryWrites=true&w=majority")
  .then(() => console.log("DB is connected"))
  .catch((err) => console.log(err));

const app = express();

const httpServer = new HttpServer(app);

function errorHandler(err, req, res, next) {
    console.error(err);
    res.status(500).send(err.stack);
}

app.use("/static", express.static(__dirname + "/public"));

app.use(errorHandler);

// ----------- Session - Begin -----------

app.use(
    session({
      secret: "secretSmile",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 10 * 60 * 1000
      }      
    })
);

// ----------- Session - End -------------

// ----------- Template - Begin ----------

app.engine('handlebars', exphbs.engine({ 
    layoutsDir: `${__dirname}/views/layouts`
}))

app.set('view engine', 'handlebars');
app.set('views', './views');

app.use(express.urlencoded({ extended: false }));

app.use(express.json());

// ----------- Template - End ------------

// ----------- Passport - Begin ----------

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy((username, password, done) => {
    User.findOne({ username }, (err, user) => {
      if (err) console.log(err);
      if (!user) return done(null, false);
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) console.log(err);
        if (isMatch) return done(null, user);
        return done(null, false);
      });
    });
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// ----------- Passport - End -----------

// ----------- Routes - Begin -----------

function auth(req, res, next) {
    if (req.isAuthenticated()) {
      next();
    } else {
      res.render("login-error");
    }
  }
  
  app.get("/", (req, res) => {
    if (req.user) {
      res.redirect("/datos");
    } else {
      res.redirect("/login");
    }
  });
  
  app.get("/login", (req, res) => {
    res.render("login");
  });
  
  app.get("/login-error", (req, res) => {
    res.render("login-error");
  });
  
  app.post(
    "/login",
    passport.authenticate("local", { failureRedirect: "login-error" }),
    (req, res) => {
      res.redirect("/datos");
    }
  );
  
  app.get("/register", (req, res) => {
    res.render("register");
  });
  
  app.post("/register", (req, res) => {
    const { username, password, direccion } = req.body;
    User.findOne({ username }, async (err, user) => {
      if (err) console.log(err);
      if (user) res.render("register-error");
      if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
          username,
          password: hashedPassword,
          direccion,
        });
        await newUser.save();
        res.redirect("/login");
      }
    });
  });
  
  app.get("/datos", async (req, res) => {
    if (req.user) {
      const datosUsuario = await User.findById(req.user._id).lean();
      res.render("datos", {
        datos: datosUsuario,
      });
    } else {
      res.redirect("/login");
    }
  });
  
  app.get("/privada", auth, (req, res) => {
    res.send("Estoy en un ruta privada");
  });
  
  app.get("/logout", (req, res, next) => {
    req.logout(function (err) {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
  });

app.use("/api/randoms", ramdomsRoutes);

app.get("/info", (req, res) => {
  const data = report.getReport();
  const info = {
      so: process.platform,
      pid: process.pid,
      rss: process.memoryUsage.rss(),
      nodejsVersion: data.header.nodejsVersion,
      execPath: process.execPath,
      arg: process.argv,
  };
  res.send(info);
});

// ----------- Routes - End ------------

const port = 8080;
httpServer.listen(port, () => {
    console.log(`Servidor http escuchando en el puerto ${port}`);
});
