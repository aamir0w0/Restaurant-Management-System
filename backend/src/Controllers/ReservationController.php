<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException, Audit, Auth, Validator};
final class ReservationController {
    private const RULES = ['customer_name' => ['type' => 'string', 'required' => true, 'max' => 120], 'phone' => ['type' => 'string', 'max' => 30], 'email' => ['type' => 'email'], 'party_size' => ['type' => 'int', 'required' => true, 'min' => 1],
        'reservation_date' => ['type' => 'date', 'required' => true], 'start_time' => ['type' => 'string', 'required' => true, 'max' => 5], 'duration_minutes' => ['type' => 'int', 'default' => 90, 'min' => 15],
        'table_id' => ['type' => 'int', 'min' => 1], 'customer_id' => ['type' => 'int', 'min' => 1], 'notes' => ['type' => 'string', 'max' => 500]];
    private const FLOW = ['booked' => ['checked_in', 'cancelled', 'no_show'], 'checked_in' => ['completed', 'cancelled']];
    public function index(Request $r): void {
        $w = []; $p = [];
        foreach (['status' => 'r.status', 'date' => 'r.reservation_date'] as $q => $col) if (!empty($r->query[$q])) { $w[] = "$col=?"; $p[] = $r->query[$q]; }
        if (!empty($r->query['q'])) { $w[] = '(r.customer_name LIKE ? OR r.phone LIKE ?)'; $p[] = '%' . $r->query['q'] . '%'; $p[] = '%' . $r->query['q'] . '%'; }
        Response::json(Db::all('SELECT r.*, t.number AS table_number, t.capacity FROM reservations r LEFT JOIN dining_tables t ON t.id=r.table_id' . ($w ? ' WHERE ' . implode(' AND ', $w) : '') . ' ORDER BY r.reservation_date DESC, r.start_time LIMIT 300', $p));
    }
    private function validate(array $d, ?int $id): void {
        if (isset($d['start_time']) && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $d['start_time'])) throw new HttpException(422, 'Validation failed', ['start_time' => 'Use HH:MM (24h)']);
        if (empty($d['table_id'])) return;
        $t = Db::one('SELECT id,capacity,status,is_active FROM dining_tables WHERE id=? FOR UPDATE', [$d['table_id']]);
        if (!$t || !$t['is_active']) throw new HttpException(422, 'Validation failed', ['table_id' => 'Unknown table']);
        if ($t['status'] === 'out_of_service') throw new HttpException(409, 'Table is out of service');
        if ($d['party_size'] > $t['capacity']) throw new HttpException(409, "Table seats {$t['capacity']} but party size is {$d['party_size']}");
        [$h, $m] = explode(':', $d['start_time']); $start = $h * 3600 + $m * 60; $end = $start + $d['duration_minutes'] * 60;
        $clash = Db::val("SELECT COUNT(*) FROM reservations WHERE table_id=? AND reservation_date=? AND status IN ('booked','checked_in') AND id<>? AND TIME_TO_SEC(start_time) < ? AND TIME_TO_SEC(start_time)+duration_minutes*60 > ?", [$d['table_id'], $d['reservation_date'], $id ?? 0, $end, $start]);
        if ($clash) throw new HttpException(409, 'That table already has a reservation overlapping this time');
    }
    public function store(Request $r): void {
        $d = Validator::clean(self::RULES, $r->body);
        $id = Db::tx(function () use ($d) { $this->validate($d, null); $cols = array_keys($d); $cols[] = 'created_by';
            return Db::insert('INSERT INTO reservations (' . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')', [...array_values($d), Auth::id()]); });
        Audit::notify('reservation', "New reservation: {$d['customer_name']} ({$d['party_size']}) {$d['reservation_date']} {$d['start_time']}", "res:$id");
        Audit::log('reservation_created', 'reservation', $id);
        Response::json(['id' => $id], 'Reservation created', 201);
    }
    public function update(Request $r): void {
        $id = (int)$r->params['id']; $old = Db::one('SELECT * FROM reservations WHERE id=?', [$id]);
        if (!$old) throw new HttpException(404, 'Not found');
        if (!isset(self::FLOW[$old['status']])) throw new HttpException(409, 'Closed reservations cannot be edited');
        $d = Validator::clean(self::RULES, $r->body, true);
        Db::tx(function () use ($d, $old, $id) { $m = array_merge($old, $d); $m['start_time'] = substr($m['start_time'], 0, 5); $this->validate($m, $id);
            if ($d) Db::run('UPDATE reservations SET ' . implode(',', array_map(fn($c) => "$c=?", array_keys($d))) . ' WHERE id=?', [...array_values($d), $id]); });
        Response::json(null, 'Updated');
    }
    public function status(Request $r): void {
        $id = (int)$r->params['id']; $to = $r->body['status'] ?? '';
        $old = Db::one('SELECT status FROM reservations WHERE id=?', [$id]);
        if (!$old) throw new HttpException(404, 'Not found');
        if (!in_array($to, self::FLOW[$old['status']] ?? [], true)) throw new HttpException(409, "Cannot move reservation from {$old['status']} to $to");
        Db::run('UPDATE reservations SET status=? WHERE id=?', [$to, $id]);
        Audit::log('reservation_' . $to, 'reservation', $id);
        Response::json(null, 'Status updated');
    }
}
