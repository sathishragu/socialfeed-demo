let passport = require('passport')
let nodeifyit = require('nodeifyit')
let LocalStrategy = require('passport-local').Strategy
let User = require('../models/user')
let util = require('util')
let FacebookStrategy = require('passport-facebook').Strategy
let TwitterStrategy = require('passport-twitter').Strategy
let GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
require('songbird')

function useExternalPassportStrategy(OauthStrategy, config, field) {
  config.passReqToCallback = true
  passport.use(new OauthStrategy(config, nodeifyit(authCB, {spread: true})))

  async function authCB(req, token, tokenSecret, account) {
    console.log('req.body: ' + JSON.stringify(req.body))
    console.log('account ' + JSON.stringify(account))
    console.log('tokenSecret ' + tokenSecret)

    let socialid = account.id
    let idField = field + '.id'
    console.log('idField: ' + idField)
    let query = {}
    query[idField] = socialid
    console.log('Query: ' + JSON.stringify(query))
    //let user = await User.promise.findOne({'facebook.id': socialid})
    let user = await User.promise.findOne(query)
    let updateUser = false
    console.log('User from the DB: ' + user)
    console.log('User from the req: ' + req.user)

    // Authorization
    if (req.user) {
      let acccredentials = req.user[field]
      user = req.user
      console.log('User from the req - field: ' + acccredentials)
      if(!acccredentials.id){
        console.log('Updating acount profile info..')
        updateUser = true
      }
    } else { // Authentication - The user doesn't exist yet
    console.log('Else')
      if (!user) {
      // create the user
      user = new User()
      updateUser = true
      }
    }

    if(updateUser){
      if(field === 'facebook'){
        user = updateFacebookDetails(account, token, tokenSecret, user, field)
      } else if (field === 'twitter'){
        user = updateTwitterDetails(account, token, tokenSecret, user, field)
      }else if(field === 'google'){
        user = updateGoogleDetails(account, token, tokenSecret, user, field)
      }
      try{
        return await user.save()
      }catch(excep){
        console.log(util.inspect(excep))
        return [false, {message: excep.message}]
      }
      console.log('User after update: ' + user)
    } else {
      return user
    }
      // 1. Load user from store
      // 2. If req.user exists, we're authorizing (connecting an account)
      // 2a. Ensure it's not associated with another account
      // 2b. Link account
      // 3. If not, we're authenticating (logging in)
      // 3a. If user exists, we're logging in via the 3rd party account
      // 3b. Otherwise create a user associated with the 3rd party account
  }

  function updateTwitterDetails(account, token, tokenSecret, user, fieldname){
    user[fieldname].username = account.username
    user[fieldname].id = account.id
    user[fieldname].name = account.displayName
    user[fieldname].token = token
    user[fieldname].tokenSecret = tokenSecret
    return user
  }

  function updateFacebookDetails(account, token, tokenSecret, user, fieldname){
    console.log('Updating facebook profile info to the user: ' + user)
    user[fieldname].email = account.emails[0].value
    user[fieldname].id = account.id
    user[fieldname].name = account.displayName
    user[fieldname].token = token
    user[fieldname].tokenSecret = tokenSecret
    return user
  }

  function updateGoogleDetails(account, token, tokenSecret, user, fieldname){
    console.log('Updating google profile info to the user: ' + user)
    user[fieldname].email = account.emails[0].value
    user[fieldname].id = account.id
    user[fieldname].name = account.displayName
    user[fieldname].token = token
    user[fieldname].tokenSecret = tokenSecret
    return user
  }
}

function configure(config) {
  // Required for session support / persistent login sessions
  passport.serializeUser(nodeifyit(async (user) => user._id))

  passport.deserializeUser(nodeifyit(async (id) => {
    return await User.promise.findById(id)
  }))
console.log(JSON.stringify(config))
  // Facebook Auth Strategy
  useExternalPassportStrategy(FacebookStrategy, {
       clientID: config.facebookAuth.consumerKey,
       clientSecret: config.facebookAuth.consumerSecret,
       callbackURL: config.facebookAuth.callbackUrl
     }, 'facebook')

console.log('consumerKey: ' + config.twitterAuth.consumerKey)

  // Twitter Auth Strategy
  useExternalPassportStrategy(TwitterStrategy, {
       consumerKey: config.twitterAuth.consumerKey,
       consumerSecret: config.twitterAuth.consumerSecret,
       callbackURL: config.twitterAuth.callbackUrl
     }, 'twitter')

  //Google Auth Strategy
  useExternalPassportStrategy(GoogleStrategy, config.googleAuth, 'google')
  // useExternalPassportStrategy(LinkedInStrategy, {...}, 'linkedin')
  // useExternalPassportStrategy(LinkedInStrategy, {...}, 'google')
  // passport.use('local-login', new LocalStrategy({...}, (req, email, password, callback) => {...}))
  // passport.use('local-signup', new LocalStrategy({...}, (req, email, password, callback) => {...}))

  passport.use('local-signin', new LocalStrategy({
    // Use "email" field instead of "username"
    usernameField: 'email',
    failureFlash: true
  }, nodeifyit(async (email, password) => {
    let user
    //if(username.indexOf('@') != -1){
      email = email.toLowerCase()
      user = await User.promise.findOne({'local.email': email})

    if (!user) {
      return [false, {message: 'Invalid username'}]
    }
    let dbUserName = user.local.email
    /*if(username.indexOf('@') != -1){
      dbUserName = user.email
    }*/
    console.log(dbUserName)
    if (!user || email !== dbUserName) {
      return [false, {message: 'Invalid username'}]
    }

    if (!await user.validatePassword(password)) {
      return [false, {message: 'Invalid password'}]
    }
    return user
  }, {spread: true})))

passport.use('local-signup', new LocalStrategy({
    // Use "email" field instead of "username"
    usernameField: 'email',
    failureFlash: true,
    passReqToCallback: true
  }, nodeifyit(async (req, email, password) => {
      email = (email || '').toLowerCase()
      // Is the email taken?
      if (await User.promise.findOne({'local.email': email})) {
        return [false, {message: 'That email is already taken.'}]
      }

      // create the user
      let user = new User()
      user.local.email = email
      user.local.password = password
      try{
        return await user.save()
      }catch(excep){
        console.log(util.inspect(excep))
        return [false, {message: excep.message}]
      }
  }, {spread: true})))

  return passport
}

module.exports = {passport, configure}
