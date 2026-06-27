/**
 * AURELIA — Customer account dashboard (Этап 47A; loyalty 69A; dashboard upgrade 86A)
 *
 * Server component. Requires a valid customer session: when logged out it renders an in-page
 * login prompt (opens the existing modal) instead of redirecting, so there is no redirect loop
 * with the modal-based auth. When logged in it renders a real customer dashboard with URL-driven
 * sections (`/account?tab=...`, server-rendered + linkable):
 *
 *   Огляд · Замовлення · Обране · Вопросы / Ответы · Очікування товарів ·
 *   Збережені пошуки · Відгуки · Профіль і безпека
 *
 * EVERYTHING is HARD-SCOPED by customerId in the data layer (a customer can never see another's
 * data). The customer's OWN Help questions, product questions, email-based availability interests
 * and reviews are read back here (no schema change — those models carry customerId). Uses existing
 * storefront classes + the account-specific au-acc-* classes (account.css) only — no product-card /
 * gallery / placeholder / design-system change.
 *
 * The engagement label is INFORMATIONAL ONLY: no points, cashback, store credit, or balance, and
 * it never affects any price/total/discount. Email sending is a foundation — NOTHING is actually
 * delivered (no provider) and the copy says so. NO stock is ever reserved or held.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentCustomer } from '../../src/lib/customer/session'
import { getAccountDashboard, type AccountDashboard } from '../../src/lib/customer/account-dashboard'
import { logoutCustomerAction } from '../../src/lib/customer/actions'
import { removeAccountFavoriteAction } from '../../src/lib/customer/wishlist-actions'
import { removeSavedSearchAction } from '../../src/lib/customer/saved-search-actions'
import { cancelProductInterestAction } from '../../src/lib/customer/product-interest-actions'
import { cancelAvailabilityInterestAction } from '../../src/lib/availability/account-actions'
import { buildSavedSearchUrl } from '../../src/lib/customer/saved-search'
import { customerOrderStatusLabel } from '../../src/lib/customer/order-display'
import { deliveryMethodLabel, paymentMethodLabel } from '../../src/lib/orders/methods'
import {
  helpQuestionCustomerLabel,
  productQuestionCustomerLabel,
  availabilityCustomerLabel,
  isHelpQuestionAnswered,
  isProductQuestionAnswered,
  isAvailabilityInterestOpen,
} from '../../src/lib/customer/account-qa'
import { formatPrice } from '../../src/lib/catalog'
import OpenLoginButton from './_components/OpenLoginButton'
import ProfileForm from './_components/ProfileForm'
import PasswordForm from './_components/PasswordForm'
import EmailVerification from './_components/EmailVerification'

export const metadata: Metadata = {
  title: 'Особистий кабінет — AURELIA',
  description: 'Особистий кабінет AURELIA: профіль, обране, замовлення, запитання та відповіді.',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' })

/** UA labels for the customer's OWN review moderation status (safe to show). */
const REVIEW_STATUS_LABELS: Record<string, string> = {
  approved: 'Опубліковано',
  pending: 'На модерації',
  rejected: 'Відхилено',
}

type TabKey =
  | 'overview'
  | 'orders'
  | 'favorites'
  | 'qa'
  | 'waiting'
  | 'searches'
  | 'reviews'
  | 'profile'

const TAB_ORDER: TabKey[] = [
  'overview',
  'orders',
  'favorites',
  'qa',
  'waiting',
  'searches',
  'reviews',
  'profile',
]

const TAB_LABELS: Record<TabKey, string> = {
  overview: 'Огляд',
  orders: 'Замовлення',
  favorites: 'Обране',
  qa: 'Вопросы / Ответы',
  waiting: 'Очікування товарів',
  searches: 'Збережені пошуки',
  reviews: 'Відгуки',
  profile: 'Профіль і безпека',
}

function isTabKey(value: string): value is TabKey {
  return (TAB_ORDER as string[]).includes(value)
}

const GemIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

function productLink(slug: string): string {
  return `/product/${encodeURIComponent(slug)}`
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const customer = await getCurrentCustomer()

  // Not logged in → in-page prompt that opens the existing login modal.
  if (!customer) {
    return (
      <div className="au-container au-checkout">
        <div className="au-co-empty">
          <span className="au-co-empty-ico">
            <GemIcon />
          </span>
          <h1 className="au-co-empty-title">Особистий кабінет</h1>
          <p className="au-co-empty-sub">Увійдіть, щоб переглянути профіль та історію замовлень.</p>
          <div className="au-co-empty-actions">
            <OpenLoginButton>Увійти</OpenLoginButton>
            <Link className="au-btn au-btn--ghost" href="/">
              На головну
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const sp = await searchParams
  const tab: TabKey = sp.tab && isTabKey(sp.tab) ? sp.tab : 'overview'
  const data = await getAccountDashboard(customer.id)

  // Tab counts (omit zero so the chips stay quiet on a new account).
  const counts: Partial<Record<TabKey, number>> = {
    orders: data.orders.total,
    favorites: data.wishlist.total,
    qa: data.questions.total,
    waiting: data.waitingTotal,
    searches: data.savedSearches.length,
    reviews: data.reviews.total,
  }

  const greeting = customer.name?.trim() || customer.email

  return (
    <div className="au-container au-checkout">
      <div className="au-acc-head">
        <h1 className="au-co-title" style={{ margin: 0 }}>
          Вітаємо, {greeting}
        </h1>
        <span className="au-acc-status">{data.engagement.labelUa}</span>
      </div>

      {/* ---- Section navigation (URL-driven, server-rendered, linkable) ---- */}
      <nav className="au-acc-tabs" aria-label="Розділи кабінету">
        {TAB_ORDER.map((key) => {
          const count = counts[key]
          const href = key === 'overview' ? '/account' : `/account?tab=${key}`
          return (
            <Link
              key={key}
              href={href}
              className={`au-acc-tab${tab === key ? ' is-active' : ''}`}
              aria-current={tab === key ? 'page' : undefined}
            >
              {TAB_LABELS[key]}
              {typeof count === 'number' && count > 0 && (
                <span className="au-acc-tab-count">{count}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {tab === 'overview' && <OverviewTab data={data} email={customer.email} />}
      {tab === 'orders' && <OrdersTab data={data} />}
      {tab === 'favorites' && <FavoritesTab data={data} />}
      {tab === 'qa' && <QaTab data={data} />}
      {tab === 'waiting' && <WaitingTab data={data} />}
      {tab === 'searches' && <SearchesTab data={data} />}
      {tab === 'reviews' && <ReviewsTab data={data} />}
      {tab === 'profile' && (
        <ProfileTab
          email={customer.email}
          name={customer.name}
          phone={customer.phone}
          emailVerified={customer.emailVerifiedAt !== null}
        />
      )}
    </div>
  )
}

/* ============================ Огляд (Overview) ============================ */

function OverviewTab({ data, email }: { data: AccountDashboard; email: string }) {
  // Merge the most recent Help + product questions for the digest (newest first).
  const recentQuestions = [
    ...data.helpQuestions.map((q) => ({
      key: `h-${q.id}`,
      title: q.subject,
      answered: isHelpQuestionAnswered(q.status),
      label: helpQuestionCustomerLabel(q.status),
      createdAt: q.createdAt,
    })),
    ...data.productQuestions.map((q) => ({
      key: `p-${q.id}`,
      title: q.productName,
      answered: isProductQuestionAnswered(q.status),
      label: productQuestionCustomerLabel(q.status),
      createdAt: q.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3)

  const availableWaiting = data.availability.filter(
    (a) => isAvailabilityInterestOpen(a.status) && a.productAvailable,
  ).length

  return (
    <>
      {/* Status cards — each links to its section. */}
      <div className="au-acc-cards">
        <Link className="au-acc-card" href="/account?tab=orders">
          <div className="au-acc-card-val">{data.orders.total}</div>
          <p className="au-acc-card-label">Замовлень</p>
        </Link>
        <Link className="au-acc-card" href="/account?tab=favorites">
          <div className="au-acc-card-val">{data.wishlist.total}</div>
          <p className="au-acc-card-label">В обраному</p>
        </Link>
        <Link className="au-acc-card" href="/account?tab=qa">
          <div className="au-acc-card-val">{data.questions.total}</div>
          <p className="au-acc-card-label">Запитань</p>
          {data.questions.answered > 0 && (
            <p className="au-acc-card-sub">Відповіли: {data.questions.answered}</p>
          )}
        </Link>
        <Link className="au-acc-card" href="/account?tab=waiting">
          <div className="au-acc-card-val">{data.waitingTotal}</div>
          <p className="au-acc-card-label">Очікую</p>
          {availableWaiting > 0 && <p className="au-acc-card-sub">Вже в продажу: {availableWaiting}</p>}
        </Link>
        <Link className="au-acc-card" href="/account?tab=searches">
          <div className="au-acc-card-val">{data.savedSearches.length}</div>
          <p className="au-acc-card-label">Збережені пошуки</p>
        </Link>
        <Link className="au-acc-card" href="/account?tab=reviews">
          <div className="au-acc-card-val">{data.reviews.total}</div>
          <p className="au-acc-card-label">Відгуків</p>
        </Link>
      </div>

      <div className="au-checkout-grid">
        <div>
          {/* Recent orders */}
          <section className="au-co-section">
            <h2 className="au-co-section-title">Останні замовлення</h2>
            {data.orders.recent.length === 0 ? (
              <p className="au-co-empty-sub">
                У вас ще немає замовлень. Оформіть перше — і воно зʼявиться тут.
              </p>
            ) : (
              <ul className="au-co-list">
                {data.orders.recent.map((order) => (
                  <li className="au-co-line" key={order.orderCode}>
                    <div className="au-co-line-main">
                      <p className="au-co-line-name">
                        <Link href={`/account/orders/${encodeURIComponent(order.orderCode)}`}>
                          <strong>{order.orderCode}</strong>
                        </Link>{' '}
                        · {customerOrderStatusLabel(order.status)}
                      </p>
                      <p className="au-co-line-meta">
                        {dateFmt.format(order.createdAt)} · {order._count.items} поз.
                      </p>
                    </div>
                    <span className="au-co-line-price">{formatPrice(order.totalAmount / 100)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="au-co-info-link">
              <Link href="/account?tab=orders">Усі замовлення →</Link>
            </p>
          </section>

          {/* Questions & answers digest */}
          <section className="au-co-section">
            <h2 className="au-co-section-title">Запитання та відповіді</h2>
            {recentQuestions.length === 0 ? (
              <p className="au-co-empty-sub">
                Ви ще не ставили запитань. Запитайте у розділі «Вопросы / Ответы» або на сторінці
                прикраси.
              </p>
            ) : (
              <ul className="au-co-list">
                {recentQuestions.map((q) => (
                  <li className="au-co-line" key={q.key}>
                    <div className="au-co-line-main">
                      <p className="au-co-line-name">{q.title}</p>
                      <p className="au-co-line-meta">{dateFmt.format(q.createdAt)}</p>
                    </div>
                    <span className={`au-acc-badge${q.answered ? ' is-answered' : ' is-pending'}`}>
                      {q.answered ? 'Є відповідь' : q.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="au-co-info-link">
              <Link href="/account?tab=qa">Усі мої запитання →</Link>
            </p>
          </section>
        </div>

        <aside className="au-co-summary">
          <h2 className="au-co-section-title">Швидкі дії</h2>
          <div className="au-acc-actions">
            <Link className="au-btn au-btn--ghost" href="/category/bijouterie">
              До каталогу
            </Link>
            <Link className="au-btn au-btn--ghost" href="/favorites">
              Обране
            </Link>
            <Link className="au-btn au-btn--ghost" href="/help">
              Вопросы / Ответы
            </Link>
            <Link className="au-btn au-btn--ghost" href="/account?tab=profile">
              Профіль
            </Link>
          </div>

          <h2 className="au-co-section-title" style={{ marginTop: 24 }}>
            Очікування товарів
          </h2>
          <p className="au-co-empty-sub">
            Ви очікуєте {data.waitingTotal} позиці(й).{' '}
            {availableWaiting > 0
              ? `Вже в продажу: ${availableWaiting}.`
              : 'Щойно щось зʼявиться — побачите тут.'}
          </p>
          <p className="au-co-info-link">
            <Link href="/account?tab=waiting">Перейти до списку очікування →</Link>
          </p>
          <p className="au-co-note">
            Email-сповіщення поки не надсилаються — поштовий сервіс не підключено. Це лише ваш
            список очікування, без бронювання товару.
          </p>
        </aside>
      </div>
      <p className="au-co-note" style={{ textAlign: 'left' }}>
        Кабінет привʼязаний до акаунта {email}. Показуємо лише запитання та запити, надіслані з
        цього акаунта.
      </p>
    </>
  )
}

/* ========================== Замовлення (Orders) ========================== */

function OrdersTab({ data }: { data: AccountDashboard }) {
  return (
    <section className="au-co-section">
      <h2 className="au-co-section-title">
        Мої замовлення
        {data.orders.total > 0 && <span className="au-co-summary-count">{data.orders.total}</span>}
      </h2>
      {data.orders.all.length === 0 ? (
        <p className="au-co-empty-sub">
          У вас ще немає замовлень. Оформіть перше — і воно зʼявиться тут.{' '}
          <Link href="/category/bijouterie">До каталогу</Link>.
        </p>
      ) : (
        <ul className="au-co-list">
          {data.orders.all.map((order) => (
            <li className="au-co-line" key={order.orderCode}>
              <div className="au-co-line-main">
                <p className="au-co-line-name">
                  <Link href={`/account/orders/${encodeURIComponent(order.orderCode)}`}>
                    <strong>{order.orderCode}</strong>
                  </Link>{' '}
                  · {customerOrderStatusLabel(order.status)}
                </p>
                <p className="au-co-line-meta">
                  {dateFmt.format(order.createdAt)} · {order._count.items} поз. ·{' '}
                  {deliveryMethodLabel(order.deliveryMethod)} · {paymentMethodLabel(order.paymentMethod)}
                </p>
              </div>
              <span className="au-co-line-price">{formatPrice(order.totalAmount / 100)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="au-co-note" style={{ textAlign: 'left' }}>
        Оплата підтверджується вручну за обраним способом. Автоматична онлайн-оплата на сайті не
        підключена.
      </p>
    </section>
  )
}

/* =========================== Обране (Favorites) ========================== */

function FavoritesTab({ data }: { data: AccountDashboard }) {
  return (
    <section className="au-co-section">
      <h2 className="au-co-section-title">
        Обране
        {data.wishlist.total > 0 && <span className="au-co-summary-count">{data.wishlist.total}</span>}
      </h2>
      {data.wishlist.recent.length === 0 ? (
        <p className="au-co-empty-sub">
          Поки порожньо. Позначайте прикраси сердечком — вони збережуться тут.
        </p>
      ) : (
        <ul className="au-co-list">
          {data.wishlist.recent.map((product) => (
            <li className="au-co-line" key={product.slug}>
              <div className="au-co-line-main">
                <p className="au-co-line-name">
                  <Link href={productLink(product.slug)}>
                    <strong>{product.name}</strong>
                  </Link>
                </p>
                <p className="au-co-line-meta">{product.category}</p>
              </div>
              <span className="au-co-line-price">
                {typeof product.price === 'number' ? formatPrice(product.price) : '— ₴'}
              </span>
              <form action={removeAccountFavoriteAction}>
                <input type="hidden" name="slug" value={product.slug} />
                <button className="au-btn au-btn--ghost" type="submit" aria-label={`Прибрати ${product.name} з обраного`}>
                  Прибрати
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <p className="au-co-info-link">
        <Link href="/favorites">Уся сторінка «Обране» →</Link>
      </p>
    </section>
  )
}

/* ===================== Вопросы / Ответы (My Q&A) ======================== */

function QaTab({ data }: { data: AccountDashboard }) {
  return (
    <>
      <section className="au-co-section">
        <h2 className="au-co-section-title">Загальні запитання</h2>
        {data.helpQuestions.length === 0 ? (
          <p className="au-co-empty-sub">
            Ви ще не ставили загальних запитань. Поставте запитання у розділі{' '}
            <Link href="/help">«Вопросы / Ответы»</Link>.
          </p>
        ) : (
          <ul className="au-co-list" style={{ display: 'block' }}>
            {data.helpQuestions.map((q) => {
              const answered = isHelpQuestionAnswered(q.status)
              return (
                <li className="au-acc-qa" key={q.id}>
                  <div className="au-acc-qa-head">
                    <p className="au-acc-qa-title">{q.subject}</p>
                    <span className={`au-acc-badge${answered ? ' is-answered' : ' is-pending'}`}>
                      {helpQuestionCustomerLabel(q.status)}
                    </span>
                  </div>
                  <p className="au-acc-qa-body">{q.message}</p>
                  <p className="au-acc-qa-meta">{dateFmt.format(q.createdAt)}</p>
                  {answered && q.answer && (
                    <div className="au-acc-answer">
                      <p className="au-acc-answer-label">Відповідь</p>
                      <p className="au-acc-answer-text">{q.answer}</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="au-co-section">
        <h2 className="au-co-section-title">Запитання про товар</h2>
        {data.productQuestions.length === 0 ? (
          <p className="au-co-empty-sub">
            Ви ще не ставили запитань про товар. Запитайте у блоці «Запитання про товар» на сторінці
            прикраси.
          </p>
        ) : (
          <ul className="au-co-list" style={{ display: 'block' }}>
            {data.productQuestions.map((q) => {
              const answered = isProductQuestionAnswered(q.status)
              return (
                <li className="au-acc-qa" key={q.id}>
                  <div className="au-acc-qa-head">
                    <p className="au-acc-qa-title">
                      {q.productPublished ? (
                        <Link href={productLink(q.productSlug)}>{q.productName}</Link>
                      ) : (
                        q.productName
                      )}
                    </p>
                    <span className={`au-acc-badge${answered ? ' is-answered' : ' is-pending'}`}>
                      {productQuestionCustomerLabel(q.status)}
                    </span>
                  </div>
                  <p className="au-acc-qa-body">{q.body}</p>
                  <p className="au-acc-qa-meta">{dateFmt.format(q.createdAt)}</p>
                  {answered && q.answer && (
                    <div className="au-acc-answer">
                      <p className="au-acc-answer-label">Відповідь</p>
                      <p className="au-acc-answer-text">{q.answer}</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="au-co-note" style={{ textAlign: 'left' }}>
        Показуємо лише запитання, надіслані з цього акаунта. Запитання, надіслані як гість (без
        входу), сюди не потрапляють.
      </p>
    </>
  )
}

/* ================== Очікування товарів (Waiting) ======================== */

function WaitingTab({ data }: { data: AccountDashboard }) {
  const hasAny = data.interests.length > 0 || data.availability.length > 0
  return (
    <>
      {/* Login-only interests (69A) */}
      <section className="au-co-section">
        <h2 className="au-co-section-title">
          Стежу за наявністю
          {data.interests.length > 0 && (
            <span className="au-co-summary-count">{data.interests.length}</span>
          )}
        </h2>
        {data.interests.length === 0 ? (
          <p className="au-co-empty-sub">
            Якщо прикраса зараз недоступна, натисніть «Повідомити, коли буде доступно» на її
            сторінці — і вона зʼявиться тут.
          </p>
        ) : (
          <ul className="au-co-list">
            {data.interests.map((i) => (
              <li className="au-co-line" key={i.id}>
                <div className="au-co-line-main">
                  <p className="au-co-line-name">
                    <Link href={productLink(i.productSlug)}>
                      <strong>{i.productName}</strong>
                    </Link>
                  </p>
                  <p className="au-co-line-meta">
                    {i.available ? 'Вже в продажу' : 'Очікується'} · {dateFmt.format(i.createdAt)}
                  </p>
                </div>
                <form action={cancelProductInterestAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="au-btn au-btn--ghost" type="submit" aria-label={`Більше не стежити за ${i.productName}`}>
                    Не стежити
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Email-based availability interests (79A) — now visible in the account (86A) */}
      <section className="au-co-section">
        <h2 className="au-co-section-title">
          Запити «повідомити про наявність»
          {data.availability.length > 0 && (
            <span className="au-co-summary-count">{data.availability.length}</span>
          )}
        </h2>
        {data.availability.length === 0 ? (
          <p className="au-co-empty-sub">
            Тут зʼявляться прикраси, для яких ви залишили e-mail у формі «Повідомити про наявність».
          </p>
        ) : (
          <ul className="au-co-list">
            {data.availability.map((a) => {
              const open = isAvailabilityInterestOpen(a.status)
              return (
                <li className="au-co-line" key={a.id}>
                  <div className="au-co-line-main">
                    <p className="au-co-line-name">
                      {a.productPublished ? (
                        <Link href={productLink(a.productSlug)}>
                          <strong>{a.productName}</strong>
                        </Link>
                      ) : (
                        <strong>{a.productName}</strong>
                      )}
                    </p>
                    <p className="au-co-line-meta">
                      {availabilityCustomerLabel(a.status)}
                      {a.productAvailable ? ' · вже в продажу' : ''}
                      {a.emailMasked ? ` · ${a.emailMasked}` : ''} · {dateFmt.format(a.createdAt)}
                    </p>
                  </div>
                  {open && (
                    <form action={cancelAvailabilityInterestAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="au-btn au-btn--ghost" type="submit" aria-label={`Скасувати запит для ${a.productName}`}>
                        Скасувати
                      </button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="au-co-note" style={{ textAlign: 'left' }}>
        {hasAny
          ? 'Листи-сповіщення поки не надсилаються — поштовий сервіс не підключено. Це лише список очікування; товар не бронюється і не резервується.'
          : 'Це список очікування, а не бронювання. Листи поки не надсилаються — поштовий сервіс не підключено.'}
      </p>
    </>
  )
}

/* =================== Збережені пошуки (Saved searches) ================== */

function SearchesTab({ data }: { data: AccountDashboard }) {
  return (
    <section className="au-co-section">
      <h2 className="au-co-section-title">
        Збережені пошуки
        {data.savedSearches.length > 0 && (
          <span className="au-co-summary-count">{data.savedSearches.length}</span>
        )}
      </h2>
      {data.savedSearches.length === 0 ? (
        <p className="au-co-empty-sub">
          Збережіть зручні фільтри каталогу (ціна, матеріал, сортування) — і повертайтесь до них
          одним кліком. Кнопка «Зберегти пошук» зʼявляється у каталозі та пошуку.
        </p>
      ) : (
        <ul className="au-co-list">
          {data.savedSearches.map((s) => (
            <li className="au-co-line" key={s.id}>
              <div className="au-co-line-main">
                <p className="au-co-line-name">
                  <Link href={buildSavedSearchUrl(s)}>
                    <strong>{s.label}</strong>
                  </Link>
                </p>
                <p className="au-co-line-meta">{dateFmt.format(s.createdAt)}</p>
              </div>
              <form action={removeSavedSearchAction}>
                <input type="hidden" name="id" value={s.id} />
                <button className="au-btn au-btn--ghost" type="submit" aria-label={`Видалити збережений пошук ${s.label}`}>
                  Видалити
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ============================ Відгуки (Reviews) ========================= */

function ReviewsTab({ data }: { data: AccountDashboard }) {
  return (
    <section className="au-co-section">
      <h2 className="au-co-section-title">
        Мої відгуки
        {data.reviews.total > 0 && <span className="au-co-summary-count">{data.reviews.total}</span>}
      </h2>
      {data.reviewsList.length === 0 ? (
        <p className="au-co-empty-sub">
          Ви ще не залишали відгуків. Поділіться враженням на сторінці прикраси — після модерації
          відгук зʼявиться публічно.
        </p>
      ) : (
        <ul className="au-co-list" style={{ display: 'block' }}>
          {data.reviewsList.map((r) => {
            const approved = r.status === 'approved'
            const rejected = r.status === 'rejected'
            return (
              <li className="au-acc-qa" key={r.id}>
                <div className="au-acc-qa-head">
                  <p className="au-acc-qa-title">
                    {r.productPublished ? (
                      <Link href={productLink(r.productSlug)}>{r.productName}</Link>
                    ) : (
                      r.productName
                    )}
                  </p>
                  <span
                    className={`au-acc-badge${approved ? ' is-answered' : rejected ? ' is-muted' : ' is-pending'}`}
                  >
                    {REVIEW_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>
                <p className="au-acc-qa-meta">
                  {'★'.repeat(Math.max(1, Math.min(5, r.rating)))}
                  {'☆'.repeat(Math.max(0, 5 - Math.max(1, Math.min(5, r.rating))))} ·{' '}
                  {dateFmt.format(r.createdAt)}
                </p>
                <p className="au-acc-qa-body">{r.body}</p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ==================== Профіль і безпека (Profile) ====================== */

function ProfileTab({
  email,
  name,
  phone,
  emailVerified,
}: {
  email: string
  name: string | null
  phone: string | null
  emailVerified: boolean
}) {
  return (
    <div className="au-checkout-grid">
      <div>
        <section className="au-co-section">
          <h2 className="au-co-section-title">Профіль</h2>
          <ul className="au-co-list">
            <li className="au-co-line">
              <div className="au-co-line-main">
                <span className="au-co-line-meta">E-mail</span>
                <p className="au-co-line-name">{email}</p>
                {/* Email verification status (Этап 60A) — foundation, nothing emailed. */}
                <EmailVerification verified={emailVerified} />
              </div>
            </li>
            {phone && (
              <li className="au-co-line">
                <div className="au-co-line-main">
                  <span className="au-co-line-meta">Телефон</span>
                  <p className="au-co-line-name">{phone}</p>
                </div>
              </li>
            )}
          </ul>

          {/* Editable name/phone (Этап 47B). Email stays read-only above. */}
          <ProfileForm initialName={name ?? ''} initialPhone={phone ?? ''} />

          <form action={logoutCustomerAction}>
            <button className="au-btn au-btn--ghost au-btn--block" type="submit">
              Вийти
            </button>
          </form>
        </section>
      </div>

      <aside className="au-co-summary">
        <h2 className="au-co-section-title">Зміна пароля</h2>
        <PasswordForm />
        <p className="au-co-note" style={{ textAlign: 'left' }}>
          Підтвердження e-mail та відновлення пароля — це основа без реального надсилання листів:
          поштовий сервіс ще не підключено.
        </p>
      </aside>
    </div>
  )
}
