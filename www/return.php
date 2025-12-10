<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['code'])) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'Missing code']);
    exit;
}
$code = trim($input['code']);

// find the unreturned item
$stmt = $mysqli->prepare("SELECT id, borrower_fk FROM borrow_items WHERE code = ? AND returned = 0 LIMIT 1");
$stmt->bind_param('s', $code);
$stmt->execute();
$res = $stmt->get_result();
$row = $res->fetch_assoc();
$stmt->close();

if (!$row) {
    echo json_encode(['ok'=>false,'error'=>'Item not found or already returned']);
    exit;
}

$item_id = (int)$row['id'];
$borrower_fk = (int)$row['borrower_fk'];

$now = round(microtime(true)*1000);
$upd = $mysqli->prepare("UPDATE borrow_items SET returned = 1, returned_at = ? WHERE id = ?");
$upd->bind_param('ii', $now, $item_id);
$ok = $upd->execute();
$upd->close();

if (!$ok) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'Could not update item']);
    exit;
}

// check if borrower has remaining unreturned items
$stmt2 = $mysqli->prepare("SELECT COUNT(*) AS cnt FROM borrow_items WHERE borrower_fk = ? AND returned = 0");
$stmt2->bind_param('i', $borrower_fk);
$stmt2->execute();
$r2 = $stmt2->get_result()->fetch_assoc();
$stmt2->close();

$remaining = isset($r2['cnt']) ? (int)$r2['cnt'] : 0;
if ($remaining === 0) {
    // mark borrower as all returned
    $u = $mysqli->prepare("UPDATE borrowers SET is_all_returned = 1 WHERE id = ?");
    $u->bind_param('i', $borrower_fk);
    $u->execute();
    $u->close();
}

echo json_encode(['ok'=>true,'status'=>'returned','borrower_fk'=>$borrower_fk,'remaining'=>$remaining]);
?>
