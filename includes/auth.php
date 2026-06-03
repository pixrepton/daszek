<?php
if (!defined('ABSPATH')) exit;

/**
 * Autoryzacja i sesje
 */


/**
 * Inicjalizacja sesji
 */
function daszek_session_start() {
    if (session_status() === PHP_SESSION_NONE) {
        $config = daszek_get_config();
        $lifetime = (int) $config['session']['lifetime'];
        if ($lifetime < 3600) {
            $lifetime = 3600;
        }
        // Bez tego PHP domyślnie czyści pliki sesji (np. po ~24 min) mimo długiego cookie — wtedy Daszek „wylogowuje” nagle.
        ini_set('session.gc_maxlifetime', (string) $lifetime);

        session_set_cookie_params([
            'lifetime' => $lifetime,
            'path' => '/',
            'domain' => '',
            'secure' => is_ssl(),
            'httponly' => true,
            'samesite' => 'Lax'
        ]);

        session_name($config['session']['cookie_name']);
        session_start();
    }
}

/**
 * Generowanie tokenu CSRF
 */
function daszek_generate_csrf_token() {
    daszek_session_start();

    if (!isset($_SESSION['daszek_csrf_token'])) {
        $_SESSION['daszek_csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['daszek_csrf_token'];
}

/**
 * Weryfikacja tokenu CSRF
 */
function daszek_verify_csrf_token($token) {
    daszek_session_start();

    if (!isset($_SESSION['daszek_csrf_token'])) {
        return false;
    }

    return hash_equals($_SESSION['daszek_csrf_token'], $token);
}

/**
 * Logowanie użytkownika
 */
function daszek_login($login, $password) {
    $config = daszek_get_config();

    if (!isset($config['users'][$login])) {
        return false;
    }

    if (!password_verify($password, $config['users'][$login])) {
        return false;
    }

    daszek_session_start();
    $_SESSION['daszek_user'] = $login;
    $now = time();
    $_SESSION['daszek_login_time'] = $now;
    $_SESSION['daszek_last_activity'] = $now;

    return true;
}

/**
 * Wylogowanie użytkownika
 */
function daszek_logout() {
    daszek_session_start();

    unset($_SESSION['daszek_user']);
    unset($_SESSION['daszek_login_time']);
    unset($_SESSION['daszek_last_activity']);
    unset($_SESSION['daszek_csrf_token']);

    session_destroy();
}

/**
 * Sprawdzenie czy użytkownik jest zalogowany
 */
function daszek_is_logged_in() {
    daszek_session_start();

    if (!isset($_SESSION['daszek_user'])) {
        return false;
    }

    $config = daszek_get_config();
    $lifetime = (int) $config['session']['lifetime'];
    $last = (int) ($_SESSION['daszek_last_activity'] ?? $_SESSION['daszek_login_time'] ?? 0);

    // Brak aktywności dłużej niż lifetime — wyloguj (wcześniej liczono tylko od logowania, więc „żywa” sesja też wygasała).
    if ($last <= 0 || time() - $last > $lifetime) {
        daszek_logout();
        return false;
    }

    $_SESSION['daszek_last_activity'] = time();

    return true;
}

/**
 * Pobranie zalogowanego użytkownika
 */
function daszek_current_user() {
    daszek_session_start();
    return $_SESSION['daszek_user'] ?? null;
}

/**
 * Middleware autoryzacyjne dla REST API
 */
function daszek_check_auth() {
    daszek_session_start();

    if (!daszek_is_logged_in()) {
        return new WP_Error('unauthorized', 'Wymagane logowanie', ['status' => 401]);
    }

    return true;
}

/**
 * Middleware CSRF dla REST API
 */
function daszek_check_csrf($request) {
    $token = $request->get_header('X-CSRF-Token');

    if (!$token || !daszek_verify_csrf_token($token)) {
        return new WP_Error('invalid_csrf', 'Nieprawidłowy token CSRF', ['status' => 403]);
    }

    return true;
}
