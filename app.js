var server = "sql12.freemysqlhosting.net";
var port = 3306;
var db = "sql12659647";
var user = "sql12659647";
var pwd = "nIdjnAWUds";

function connectToMySQL() {
  var url = "jdbc:mysql://" + server + ":" + port + "/" + db;
  var conn = Jdbc.getConnection(url, user, pwd);
  if (conn) {
    Logger.log("Connected to the MySQL server successfully.");
  } else {
    Logger.log("Failed to establish a database connection.");
  }
  return conn;
}

function createTableIfNotExists() {
  var conn = connectToMySQL();
  if (conn == null) {
    Logger.log("Connection to MySQL failed.");
    return;
  }
  try {
    var stmt = conn.createStatement();
    stmt.execute(
      "CREATE TABLE IF NOT EXISTS emails (id INT AUTO_INCREMENT PRIMARY KEY, subject VARCHAR(255), date DATETIME, body TEXT)"
    );
    Logger.log("Table 'emails' created (if it didn't already exist).");
    // Add a table for storing URLs
    stmt.execute(
      "CREATE TABLE IF NOT EXISTS urls (id INT AUTO_INCREMENT PRIMARY KEY, email_id INT, url VARCHAR(255))"
    );
    Logger.log("Table 'urls' created (if it didn't already exist).");
  } catch (e) {
    Logger.log('Error creating table: ' + e);
  } finally {
    stmt.close();
    conn.close();
  }
}

function extractUrlsFromBody(body) {
  // Regular expression to find URLs in the email body.
  var urlRegex = /https?:\/\/[^\s]+/g;
  var urls = body.match(urlRegex);
  return urls;
}

function isEmailAlreadyInserted(conn, emailContent) {
  try {
    var stmt = conn.prepareStatement('SELECT id FROM emails WHERE subject = ? AND date = ?');
    stmt.setString(1, emailContent.subject);
    stmt.setObject(2, new Date(emailContent.date));
    var rs = stmt.executeQuery();
    return rs.next(); // If a record with the same subject and date exists, return true (duplicate)
  } catch (e) {
    Logger.log('Error checking for duplicate email: ' + e);
    return true; // Assume it's a duplicate if there's an error
  } finally {
    stmt.close();
  }
}

function insertEmailAndUrlsIntoMySQL(emailContent) {
  var conn = connectToMySQL();
  if (conn == null) {
    Logger.log("Connection to MySQL failed.");
    return;
  }
  var stmt = null; // Initialize stmt here to ensure it's defined.

  try {
    if (isEmailAlreadyInserted(conn, emailContent)) {
      Logger.log('Email is already in the database, skipping insertion.');
      return;
    }

    stmt = conn.prepareStatement('INSERT INTO emails (subject, date, body) VALUES (?, ?, ?)');
    stmt.setString(1, emailContent.subject);
    stmt.setObject(2, new Date(emailContent.date));
    stmt.setString(3, emailContent.body);
    stmt.execute();
    Logger.log('Email inserted into the database.');

    var emailId = getLastInsertedEmailId(conn);

    var urls = extractUrlsFromBody(emailContent.body);
    if (urls && urls.length > 0) {
      stmt = conn.prepareStatement('INSERT INTO urls (email_id, url) VALUES (?, ?)');
      for (var i = 0; i < urls.length; i++) {
        stmt.setInt(1, emailId);
        stmt.setString(2, urls[i]);
        stmt.execute();
      }
      Logger.log('URLs inserted into the database.');
    }
  } catch (e) {
    Logger.log('Error inserting data into MySQL: ' + e);
  } finally {
    if (stmt) {
      stmt.close();
    }
    conn.close();
  }
}

function getLastInsertedEmailId(conn) {
  var stmt = conn.createStatement();
  var rs = stmt.executeQuery("SELECT LAST_INSERT_ID()");
  rs.next();
  return rs.getLong(1);
}

function extractEmailsAndInsertIntoMySQL() {
  createTableIfNotExists();
  var twentyFourHoursAgo = new Date(new Date() - 24 * 60 * 60 * 1000);
  var threads = GmailApp.getInboxThreads();
  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var message = messages[j];
      var date = message.getDate();
      var subject = message.getSubject();
      var body = message.getPlainBody();
      if (date >= twentyFourHoursAgo) {
        var emailContent = {
          subject: subject,
          date: date,
          body: body
        };
        insertEmailAndUrlsIntoMySQL(emailContent);
      }
    }
  }
}


extractEmailsAndInsertIntoMySQL();
