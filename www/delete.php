<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'Missing payload']);
    exit;
}

$borrowerId = $input['borrowerId'] ?? null;
$borrower_db_id = isset($input['borrower_db_id']) ? (int)$input['borrower_db_id'] : null;

if (!$borrowerId && !$borrower_db_id) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'No borrower identifier provided']);
    exit;
}

if ($borrower_db_id) {
    $stmt = $mysqli->prepare("DELETE FROM borrowers WHERE id = ?");
    $stmt->bind_param('i', $borrower_db_id);
    $ok = $stmt->execute();
    $stmt->close();
    echo json_encode(['ok'=>$ok, 'deleted_db_id'=>$borrower_db_id]);
    exit;
}

// else try delete by borrower_id
$stmt = $mysqli->prepare("DELETE FROM borrowers WHERE borrower_id = ?");
$stmt->bind_param('s', $borrowerId);
$ok = $stmt->execute();
$stmt->close();
echo json_encode(['ok'=>$ok, 'deleted_borrower_id'=>$borrowerId]);
?>
