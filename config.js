/* Налаштування платформи Robot School Academy.
   MODE: 'beta'  — усе зберігається лише в цьому браузері, нікуди не надсилається (для тестування без хостингу);
         'prod'  — реєстрація, результати й повідомлення надсилаються в Google Таблиці через Google Apps Script.
   API_URL (рядок 8): адреса веб-застосунку Apps Script (закінчується на /exec). Див. README.txt. */
window.RS_CONFIG = {
  MODE: 'prod',
  // ↓↓↓ ВСТАВТЕ СЮДИ АДРЕСУ ВЕБ-ЗАСТОСУНКУ APPS SCRIPT (…/exec) ↓↓↓
  API_URL: 'https://script.google.com/macros/s/AKfycbzgKYzrnUpU7tQFs1JFDikY0G_6OIvqSqmEfujVCnnFI4kwjhMsGQReNr30nMIMclvx/exec',
  PASS_PERCENT: 80,
  // Список філій для бета-версії. У робочій версії список береться з Code.gs (BRANCH_SHEETS).
  BRANCHES: ['Полтава', 'Онлайн', 'Кременчук', 'Київ — виїзні заняття'],
  // Адміністратор: логін і SHA-256 хеш пароля (сам пароль тут не зберігається). Має збігатися з Code.gs.
  ADMIN_LOGIN: 'robotschool',
  ADMIN_HASH: '1d1a7bc3337eed8d521fd9e316ddc6321b599f19d09426d084d9addf51f39562',
  CONTACT: 'Методичний відділ Robot School · +38 (066) 545-91-28 · achaban62@gmail.com',
  CONTACT_PHONE: '066 545 91 28',
  CONTACT_EMAIL: 'achaban62@gmail.com',
  DIRS: [ {key:'robot', title:'Робототехніка'}, {key:'3d', title:'3D-графіка'}, {key:'code', title:'Програмування'} ],
  VERSION: '1.4 · 21.10.2026'
};
