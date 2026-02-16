import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { buildDownloadLinks } from "../config/downloads";
import styles from "./index.module.css";

type LandingFields = {
  landingGhOwner?: string;
  landingGhRepo?: string;
  landingContactEmail?: string;
};

const CASES = [
  "Разрозненные договоры -> агент раскладывает по клиентам и датам -> быстрее подготовка к звонкам и сверкам.",
  "Долго ищется нужный файл -> агент находит документ по описанию -> экономия времени на рутине.",
  "Сложно собрать материалы к встрече -> агент формирует подборку файлов по теме -> меньше ручной подготовки.",
  "Много однотипных офисных задач -> агент выполняет повторяемые шаги -> ниже операционная нагрузка.",
  "Нужно быстро разобраться в папке проекта -> агент строит понятную структуру -> проще передавать работу коллегам.",
  "Непонятно, с чего начать настройку -> агент даёт пошаговые действия -> быстрый запуск без техподготовки."
];

const COMPANY_SEGMENTS = [
  "Консалтинг и агентства",
  "Юридические и бухгалтерские фирмы",
  "Продажи и клиентский сервис",
  "Малые продуктовые команды",
  "Операционные подразделения"
];

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const fields = (siteConfig.customFields ?? {}) as LandingFields;
  const owner = fields.landingGhOwner ?? "redsquad-tech";
  const repo = fields.landingGhRepo ?? "is-goose";
  const email = fields.landingContactEmail ?? "bavadim@gmail.com";
  const baseUrl = siteConfig.baseUrl ?? `/${repo}/`;

  const mailto = `mailto:${email}?subject=${encodeURIComponent("Запрос ключа InsightStream")}`;
  const downloadLinks = buildDownloadLinks(owner, repo);

  return (
    <Layout
      title="InsightStream — демо"
      description="InsightStream — десктоп-агент для предпринимателей и офисных команд. Скачайте демо и запросите ключ по email."
    >
      <main className={styles.page}>
        <section id="hero" className={`py-5 ${styles.heroBand}`}>
          <div className={styles.fixedShell}>
            <div className="row g-4 align-items-stretch">
              <div className="col-lg-7">
                <h1 className="display-5 fw-bold mb-3">InsightStream — порядок в рабочих файлах и задачах за минуты</h1>
                <p className="lead text-secondary mb-4">
                  Десктоп-агент для предпринимателей и офисных команд: помогает находить документы, наводить порядок и
                  ускорять рутину на компьютере.
                </p>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <a className="btn btn-primary btn-lg" href="#download">
                    <i className="bi bi-download me-2" aria-hidden="true" />
                    Скачать демо
                  </a>
                  <a className="btn btn-outline-primary btn-lg" href="#pricing">
                    Как получить ключ
                  </a>
                </div>
                <p className="text-secondary mb-2">Демо-ключ действует 3 дня. Нужен ключ — {email}.</p>
                <p className={styles.note + " mb-0"}>
                  Если в приложении появляется ошибка доступа, запросите рабочий ключ по email.
                </p>
              </div>

              <div className="col-lg-5">
                <img
                  src={`${baseUrl}illustrations/hero-workflow.svg`}
                  alt="Схема работы InsightStream: скачать демо, использовать 3 дня, запросить ключ"
                  className={styles.heroImage}
                />
              </div>
            </div>
          </div>
        </section>

        <section id="companies" className="py-4">
          <div className={styles.fixedShell}>
            <h2 className="h3 mb-3">Для каких компаний подходит</h2>
            <div className={styles.segmentGrid}>
              {COMPANY_SEGMENTS.map((segment) => (
                <span key={segment} className={styles.segmentPill}>
                  {segment}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="py-4">
          <div className={styles.fixedShell}>
            <h2 className="h3 mb-3">Что умеет InsightStream</h2>
            <div className="row g-3">
              <div className="col-md-6">
                <article className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <h3 className="h5">Наведение порядка в папках</h3>
                    <p className="mb-0">Сортирует и структурирует рабочие файлы по понятной логике.</p>
                  </div>
                </article>
              </div>
              <div className="col-md-6">
                <article className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <h3 className="h5">Быстрый поиск информации</h3>
                    <p className="mb-0">Находит нужные документы и данные в файловой системе без долгого ручного поиска.</p>
                  </div>
                </article>
              </div>
              <div className="col-md-6">
                <article className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <h3 className="h5">Помощь с документами</h3>
                    <p className="mb-0">Помогает готовить черновики, выжимки и рабочие версии документов.</p>
                  </div>
                </article>
              </div>
              <div className="col-md-6">
                <article className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <h3 className="h5">Базовая помощь с ПК</h3>
                    <p className="mb-0">Подсказывает и автоматизирует типовые действия по настройке рабочего окружения.</p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section id="cases" className="py-4">
          <div className={styles.fixedShell}>
            <h2 className="h3 mb-3">Кейсы из повседневной работы</h2>
            <div className="card shadow-sm border-0 mb-3">
              <div className="card-body">
                <ol className="mb-0">
                  {CASES.map((item) => (
                    <li key={item} className="mb-2">
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <img
              src={`${baseUrl}illustrations/use-cases.svg`}
              alt="Иллюстрация типовых кейсов: файлы, поиск, документы"
              className={styles.casesImage}
            />
          </div>
        </section>

        <section id="download" className="py-4">
          <div className={styles.fixedShell}>
            <h2 className="h3 mb-3">Скачайте демо для macOS и Windows</h2>
            <div className="row g-3">
              <div className="col-lg-8">
                <div className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <p className="mb-2">Установка занимает несколько минут. Демо-ключ активен 3 дня.</p>
                    <p className="mb-3 text-secondary">
                      После истечения демо или ошибки доступа запросите рабочий ключ по email.
                    </p>
                    <div className="d-grid gap-2">
                      {downloadLinks.map((link) => (
                        <a key={link.id} className={`btn btn-outline-primary ${styles.platformButton}`} href={link.url}>
                          <span className={styles.platformLeft}>
                            <i className={`bi ${link.iconClass} ${styles.platformIcon}`} aria-hidden="true" />
                            <span>{link.label}</span>
                          </span>
                          <span className={styles.platformMeta}>{link.minSystem}</span>
                        </a>
                      ))}
                    </div>
                    <p className="text-secondary mt-3 mb-0">Запрос ключа и поддержка: {email}</p>
                  </div>
                </div>
              </div>

              <div className="col-lg-4">
                <aside className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <h3 className="h5">Доверие и поддержка</h3>
                    <ul className="mb-0">
                      <li>Разработчик: ООО Инсайтстрим</li>
                      <li>Запрос ключа и вопросы: {email}</li>
                      <li>При проблеме установки отправьте описание и скриншот на email</li>
                      <li>
                        Для технической прозрачности: <a href="https://github.com/block/goose">upstream Goose</a>
                      </li>
                    </ul>
                  </div>
                </aside>
              </div>
            </div>
            <div className={`alert mt-3 mb-0 ${styles.riskAlert}`} role="alert">
              <strong>Важно:</strong> функции ИИ требуют контроля со стороны пользователя. Не передавайте доступ к критичным
              данным без проверки, используйте резервные копии и проверяйте результат перед применением.
            </div>
          </div>
        </section>

        <section id="pricing" className="py-4">
          <div className={styles.fixedShell}>
            <h2 className="h3 mb-3">Один тариф без сложных опций</h2>
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <p className="display-6 mb-2">5000 ₽ / месяц</p>
                <p>Полный доступ к функциям InsightStream, обновления и поддержка по email.</p>
                <ol>
                  <li>Напишите на {email}</li>
                  <li>Получите счёт в ответ</li>
                  <li>После оплаты получите ключ</li>
                  <li>Активируйте ключ в приложении</li>
                </ol>
                <p className="text-secondary">Ключ отправляется в течение 1 рабочего дня после подтверждённой оплаты.</p>
                <a className="btn btn-primary" href={mailto}>
                  Запросить ключ по email
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="py-4">
          <div className={styles.fixedShell}>
            <h2 className="h3 mb-3">FAQ</h2>
            <div className="row g-3">
              <div className="col-md-6">
                <article className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <h3 className="h5">Что можно делать бесплатно?</h3>
                    <p className="mb-0">Демо-ключ действует 3 дня и позволяет протестировать основные сценарии на ваших файлах.</p>
                  </div>
                </article>
              </div>
              <div className="col-md-6">
                <article className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <h3 className="h5">Что будет после демо?</h3>
                    <p className="mb-0">После истечения демо или ошибки доступа запросите ключ на {email}.</p>
                  </div>
                </article>
              </div>
              <div className="col-md-6">
                <article className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <h3 className="h5">Как получить ключ?</h3>
                    <p className="mb-0">Напишите на {email}, получите счёт и после оплаты ключ.</p>
                  </div>
                </article>
              </div>
              <div className="col-md-6">
                <article className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <h3 className="h5">Это безопасно для файлов?</h3>
                    <p className="mb-0">
                      ИИ-инструменты могут ошибаться. Рекомендуется начинать с копий важных данных, ограничивать права доступа и
                      проверять каждое критичное действие вручную.
                    </p>
                  </div>
                </article>
              </div>
            </div>

            <div className="border-top mt-4 pt-3" id="footer">
              <p className="mb-1">InsightStream — десктоп-агент для повседневной работы.</p>
              <p className="mb-1">
                Контакт: <a href={`mailto:${email}`}>{email}</a>
              </p>
              <p className="mb-1">
                Для разработчиков: <a href="https://github.com/block/goose">Goose (upstream)</a>
              </p>
              <p className="text-secondary mb-0">Условия доступа и оплаты опубликованы в разделе оферты.</p>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
