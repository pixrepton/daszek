<?php
if (!defined('ABSPATH')) {
    require_once dirname(__DIR__, 3) . '/wp-load.php';
}

require_once dirname(__DIR__, 1) . '/includes/auth.php';
daszek_session_start();
$csrf = daszek_generate_csrf_token();
?>
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daszek - TOP-INSTAL</title>
    <link rel="icon" href="<?php echo esc_url(DASZEK_PLUGIN_URL . 'public/favicon.svg?v=' . DASZEK_VERSION); ?>" type="image/svg+xml">
    <meta name="csrf-token" content="<?php echo esc_attr($csrf); ?>">
    <link rel="stylesheet" href="<?php echo esc_url(DASZEK_PLUGIN_URL . 'public/style.css?v=' . DASZEK_VERSION . '.' . filemtime(DASZEK_PLUGIN_DIR . 'public/style.css')); ?>">
</head>
<body>
    <a href="#view-root" class="skip-link">Przejdź do treści</a>
    <div id="app">
        <section id="login-screen" class="screen screen-login">
            <div class="login-shell">
                <div class="login-copy">
                    <p class="eyebrow">TOP-INSTAL</p>
                    <h1>Daszek</h1>
                    <p class="subtitle">Case OS — biurko operatorskie. Spokojne, selektywne i gotowe zanim zaczniesz dzień.</p>
                </div>

                <div class="login-card">
                    <h2>Zaloguj się</h2>
                    <p class="login-hint">Wejdź do biurka i sprawdź to, co AI uznało za naprawdę istotne.</p>

                    <form id="login-form">
                        <div class="form-group">
                            <label for="login">Użytkownik</label>
                            <input type="text" id="login" name="login" required autofocus autocomplete="username">
                        </div>

                        <div class="form-group">
                            <label for="password">Hasło</label>
                            <input type="password" id="password" name="password" required autocomplete="current-password">
                        </div>

                        <button type="submit" class="btn btn-primary btn-full">Zaloguj</button>
                        <div id="login-error" class="error-message" style="display:none;" role="alert" aria-live="assertive"></div>
                    </form>
                </div>
            </div>
        </section>

        <section id="main-screen" class="screen screen-main" style="display:none;">
            <header class="topbar">
                <div class="topbar-brand">
                    <p class="eyebrow">TOP-INSTAL</p>
                    <h1>Daszek</h1>
                    <p class="topbar-subtitle">Case OS — biurko operatorskie (kanał Oferta HVAC osobno)</p>
                </div>

                <div class="topbar-tools">
                    <label class="search-field" for="global-search">
                        <span>Szukaj</span>
                        <input type="search" id="global-search" placeholder="Szukaj po kartkach i sprawach">
                    </label>
                    <button type="button" id="theme-toggle" class="btn btn-ghost btn-small" aria-label="Przełącz motyw jasny lub ciemny">Motyw</button>
                    <div class="user-pill">Zalogowany: <strong id="current-user"></strong></div>
                    <button type="button" id="refresh-btn" class="btn btn-ghost btn-small">Odśwież</button>
                    <button id="logout-btn" class="btn btn-secondary" type="button">Wyloguj</button>
                </div>
            </header>

            <nav id="view-tabs" class="view-tabs" aria-label="Widoki Daszek">
                <button type="button" class="view-tab active" data-view="desk">Biurko Case OS</button>
                <button type="button" class="view-tab" data-view="cases">Sprawy Case OS</button>
                <button type="button" class="view-tab" data-view="day">Dzień</button>
                <button type="button" class="view-tab" data-view="archive">Archiwum</button>
                <button type="button" class="view-tab" data-view="chat">Czat</button>
                <div class="view-tabs-more">
                    <button type="button" id="view-tabs-more-btn" class="view-tab view-tab-more" aria-haspopup="true" aria-expanded="false">Więcej ▾</button>
                    <div id="view-tabs-more-menu" class="view-tabs-more-menu" hidden>
                        <button type="button" class="view-tab-more-item nav-link" data-view="cockpit">Cockpit</button>
                        <button type="button" class="view-tab-more-item nav-link" data-view="quality">Jakość AI</button>
                        <button type="button" class="view-tab-more-item nav-link" data-view="system">System Case OS</button>
                        <button type="button" class="view-tab-more-item nav-link" data-view="last_ingress">Ostatni ingress</button>
                        <button type="button" class="view-tab-more-item nav-link" data-view="cohort_runs">Kohorty</button>
                        <button type="button" class="view-tab-more-item nav-link" data-view="decisions">Kolejka decyzji</button>
                        <button type="button" class="view-tab-more-item nav-link" data-view="identity">Tożsamość</button>
                        <button type="button" class="view-tab-more-item nav-link" data-view="constitution">Konstytucja</button>
                    </div>
                </div>
            </nav>

            <div id="detail-panel-backdrop" class="detail-panel-backdrop" hidden aria-hidden="true"></div>

            <div class="workspace">
                <aside class="sidebar">
                    <div id="view-summary" class="sidebar-card sidebar-summary"></div>
                </aside>

                <main class="content" role="main" aria-label="Treść Daszek">
                    <div id="view-header" class="view-header"></div>
                    <div id="global-error" class="error-message" style="display:none;" role="alert" aria-live="assertive"></div>
                    <div id="view-root" class="view-root" tabindex="-1"></div>
                </main>

                <aside id="detail-panel" class="detail-panel" aria-live="polite">
                    <div class="detail-empty">
                        <h2>Panel szczegółów</h2>
                        <p>Otwórz kartkę albo sprawę, aby zobaczyć sedno tematu i wykonać ocenę.</p>
                    </div>
                </aside>
            </div>
        </section>
    </div>

    <div id="toast-host" class="toast-host" aria-live="polite" aria-relevant="additions text"></div>

    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script src="<?php echo esc_url(DASZEK_PLUGIN_URL . 'public/system-diagrams-manifest.js?v=' . DASZEK_VERSION); ?>"></script>
    <script src="<?php echo esc_url(DASZEK_PLUGIN_URL . 'public/app.js?v=' . DASZEK_VERSION . '.' . filemtime(DASZEK_PLUGIN_DIR . 'public/app.js')); ?>"></script>
</body>
</html>
<?php exit; ?>
