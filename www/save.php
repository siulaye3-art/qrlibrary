<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['borrower']) || !isset($input['books'])) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'Invalid payload']);
    exit;
}

$borrower = $input['borrower'];
$books = $input['books'];

$name = $borrower['name'] ?? '';
$borrower_id = $borrower['id'] ?? null;
$email = $borrower['email'] ?? null;
$phone = $borrower['phone'] ?? null;
$course = $borrower['course'] ?? null;
$year = $borrower['year'] ?? null;
$department = $borrower['department'] ?? null;
$timestamp = $input['timestamp'] ?? round(microtime(true)*1000);
$dueDate = $input['dueDate'] ?? ($timestamp + 30*24*60*60*1000);

// Check duplicate active borrower
if ($borrower_id) {
    $stmt = $mysqli->prepare("SELECT id FROM borrowers WHERE borrower_id = ? AND is_all_returned = 0");
    $stmt->bind_param('s', $borrower_id);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        echo json_encode(['ok'=>false,'error'=>'Borrower already has active borrowed items']);
        exit;
    }
    $stmt->close();
}

$mysqli->begin_transaction();

try {
    $stmt = $mysqli->prepare(
        "INSERT INTO borrowers (borrower_id, name, email, phone, course, year, department, timestamp, dueDate, is_all_returned) 
         VALUES (?,?,?,?,?,?,?,?,?,0)"
    );
    $stmt->bind_param('sssssssss', $borrower_id, $name, $email, $phone, $course, $year, $department, $timestamp, $dueDate);
    if (!$stmt->execute()) throw new Exception("Could not insert borrower: ".$stmt->error);
    $borrower_fk = $stmt->insert_id;
    $stmt->close();

    $stmtIns = $mysqli->prepare("INSERT INTO borrow_items (borrower_fk, code, returned) VALUES (?, ?, 0)");
    foreach ($books as $code) {
        $codeStr = trim((string)$code);
        if ($codeStr === '') continue;
        $stmtIns->bind_param('is', $borrower_fk, $codeStr);
        if (!$stmtIns->execute()) throw new Exception("Could not insert item: ".$stmtIns->error);
    }
    $stmtIns->close();

    $mysqli->commit();
    echo json_encode(['ok'=>true, 'status'=>'success', 'borrower_db_id'=>$borrower_fk]);
} catch (Exception $e) {
    $mysqli->rollback();
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);
}
?>
