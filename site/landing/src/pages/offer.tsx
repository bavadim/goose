import Layout from "@theme/Layout";
import styles from "./offer.module.css";

export default function Offer(): JSX.Element {
  return (
    <Layout title="Публичная оферта" description="Публичная оферта InsightStream от ООО Инсайтстрим.">
      <main className={styles.page}>
        <div className="container">
          <h1 className="display-6 fw-bold mb-2">Публичная оферта InsightStream (MVP)</h1>
          <p className="text-secondary mb-4">Редакция для первой публичной версии лендинга.</p>

          <section className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h2 className="h5">1. Общие положения</h2>
              <ol className="mb-0">
              <li>Настоящий документ является предложением заключить договор предоставления доступа к ПО InsightStream.</li>
              <li>Разработчик и правообладатель: ООО Инсайтстрим.</li>
              <li>Актуальная версия оферты публикуется на сайте проекта.</li>
              </ol>
            </div>
          </section>

          <section className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h2 className="h5">2. Предмет</h2>
              <ol className="mb-0">
              <li>Исполнитель предоставляет Пользователю доступ к desktop-приложению InsightStream по ключу активации.</li>
              <li>ПО используется на условиях простой (неисключительной) лицензии без передачи исключительных прав.</li>
              </ol>
            </div>
          </section>

          <section className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h2 className="h5">3. Тариф и порядок оплаты</h2>
              <ol className="mb-0">
              <li>Стоимость доступа: 5000 рублей за 1 месяц.</li>
              <li>Оплата выполняется по счёту, направленному на email пользователя после запроса на bavadim@gmail.com.</li>
              <li>Обязательство по оплате считается исполненным после поступления денежных средств Исполнителю.</li>
              </ol>
            </div>
          </section>

          <section className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h2 className="h5">4. Предоставление ключа</h2>
              <ol className="mb-0">
              <li>После подтверждённой оплаты ключ активации направляется на email Пользователя.</li>
              <li>Срок направления ключа: в течение 1 рабочего дня (обычно в день подтверждения оплаты).</li>
              </ol>
            </div>
          </section>

          <section className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h2 className="h5">5. Демо-режим</h2>
              <ol className="mb-0">
              <li>До оплаты доступен бесплатный демо-режим на условиях, опубликованных в приложении и на лендинге.</li>
              <li>По завершении демо для продолжения работы требуется ключ.</li>
              </ol>
            </div>
          </section>

          <section className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h2 className="h5">6. Ограничение ответственности</h2>
              <ol className="mb-0">
              <li>Сервис предоставляется по модели best-effort.</li>
              <li>Исполнитель не несёт ответственности за косвенные убытки, упущенную выгоду и последствия использования ПО вне рекомендованных сценариев.</li>
              <li>Пользователю рекомендуется использовать резервные копии важных данных.</li>
              </ol>
            </div>
          </section>

          <section className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h2 className="h5">7. Поддержка и коммуникации</h2>
              <ol className="mb-0">
              <li>Канал поддержки: bavadim@gmail.com.</li>
              <li>Поддержка оказывается в рабочие часы по Москве, в разумные сроки.</li>
              </ol>
            </div>
          </section>

          <section className="card shadow-sm border-0 mb-3">
            <div className="card-body">
              <h2 className="h5">8. Возвраты и прекращение доступа</h2>
              <ol className="mb-0">
              <li>Вопросы возврата рассматриваются индивидуально по обращению на email поддержки.</li>
              <li>При нарушении условий использования Исполнитель вправе ограничить доступ с уведомлением Пользователя.</li>
              </ol>
            </div>
          </section>

          <section className="card shadow-sm border-0 mb-0">
            <div className="card-body">
              <h2 className="h5">9. Реквизиты исполнителя</h2>
              <ul className="mb-0">
              <li>Наименование: ООО Инсайтстрим</li>
              <li>Контактный email: bavadim@gmail.com</li>
              <li>ИНН/ОГРН/юридический адрес: добавляются в production-редакции оферты.</li>
              </ul>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
