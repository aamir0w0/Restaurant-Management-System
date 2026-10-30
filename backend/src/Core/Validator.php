<?php
namespace App\Core;
/** rules: field => ['type'=>string|email|int|decimal|bool|date|enum, 'required'=>bool, 'max'=>, 'min'=>, 'values'=>[], 'default'=>] */
final class Validator {
    public static function clean(array $rules, array $in, bool $partial = false): array {
        $out = []; $err = [];
        foreach ($rules as $f => $r) {
            $type = $r['type']; $req = $r['required'] ?? false;
            $present = array_key_exists($f, $in);
            if (!$present || $in[$f] === '' || $in[$f] === null) {
                if ($partial && !$present) continue;
                if ($req) { $err[$f] = 'Required'; continue; }
                $out[$f] = (!$partial && array_key_exists('default', $r)) ? $r['default'] : null;
                continue;
            }
            $v = $in[$f];
            switch ($type) {
                case 'string': $v = trim((string)$v); if (mb_strlen($v) > ($r['max'] ?? 255)) $err[$f] = 'Too long'; break;
                case 'email': $v = trim((string)$v); if (!filter_var($v, FILTER_VALIDATE_EMAIL)) $err[$f] = 'Invalid email'; break;
                case 'int': if (filter_var($v, FILTER_VALIDATE_INT) === false) { $err[$f] = 'Must be an integer'; break; } $v = (int)$v; if ($v < ($r['min'] ?? 0)) $err[$f] = 'Too small'; break;
                case 'decimal': if (!is_numeric($v)) { $err[$f] = 'Must be a number'; break; } $v = round((float)$v, $r['scale'] ?? 2); if ($v < ($r['min'] ?? 0)) $err[$f] = 'Too small'; break;
                case 'bool': $v = filter_var($v, FILTER_VALIDATE_BOOLEAN) ? 1 : 0; break;
                case 'date': $d = \DateTime::createFromFormat('Y-m-d', (string)$v); if (!$d || $d->format('Y-m-d') !== $v) $err[$f] = 'Invalid date (YYYY-MM-DD)'; break;
                case 'enum': if (!in_array($v, $r['values'], true)) $err[$f] = 'Invalid value'; break;
            }
            $out[$f] = $v;
        }
        if ($err) throw new HttpException(422, 'Validation failed', $err);
        return $out;
    }
}
