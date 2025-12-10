<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$sql = "SELECT b.id AS borrower_db_id, b.borrower_id, b.name, b.email, b.phone, b.course, b.year, b.department, b.timestamp, b.dueDate
        FROM borrowers b
        WHERE EXISTS (SELECT 1 FROM borrow_items i WHERE i.borrower_fk = b.id AND i.returned = 0)";

$res = $mysqli->query($sql);
$rows = [];
if ($res) {
    while ($r = $res->fetch_assoc()) {
        $borrower_db_id = (int)$r['borrower_db_id'];

        // fetch unreturned books
        $stmt = $mysqli->prepare("SELECT code FROM borrow_items WHERE borrower_fk = ? AND returned = 0");
        $stmt->bind_param('i', $borrower_db_id);
        $stmt->execute();
        $itemsRes = $stmt->get_result();
        $codes = [];
        while ($item = $itemsRes->fetch_assoc()) {
            $codes[] = $item['code'];
        }
        $stmt->close();

        $rows[] = [
            'id' => $borrower_db_id,
            'borrower_id' => $r['borrower_id'],
            'borrower' => [
                'name' => $r['name'],
                'id' => $r['borrower_id'],
                'email' => $r['email'],
                'phone' => $r['phone'],
                'course' => $r['course'],
                'year' => $r['year'],
                'department' => $r['department']
            ],
            'books' => $codes,
            'timestamp' => (int)$r['timestamp'],
            'dueDate' => (int)$r['dueDate']
        ];
    }
}
echo json_encode($rows);
?>
