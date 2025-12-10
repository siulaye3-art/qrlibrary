<?php
// db.php - put in same folder as PHP endpoints
$DB_HOST = 'localhost';
$DB_USER = 'root';
$DB_PASS = '';
$DB_NAME = 'library_db';
$DB_PORT = 3306; // change if needed

$mysqli = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME, $DB_PORT);
if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'DB connection failed: '.$mysqli->connect_error]);
    exit;
}
$mysqli->set_charset('utf8mb4');
