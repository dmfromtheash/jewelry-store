/**
 * AURELIA — Customer account page (Этап 47A; loyalty/account polish Этап 69A)
 *
 * Server component. Requires a valid customer session: when logged out it renders an in-page
 * login prompt (opens the existing modal) instead of redirecting, so there is no redirect loop
 * with the modal-based auth. When logged in it shows an at-a-glance account overview — profile,
 * a NON-financial engagement label + activity summary, email-verification state, security,
 * wishlist, saved searches, product-interest tracking, the customer's OWN order history, and a
 * reviews summary. Everything is HARD-SCOPED by customerId in the data layer (a customer can
 * never see another's data). Uses existing storefront classes only — no new design/CSS.
 *
 * The engagement label is INFORMATIONAL ONLY: no points, cashback, store credit, or balance,
 * and it never affects any price/total/discount. Email sending is a foundation — nothing is
 * actually delivered (no provider), and the copy says so.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentCustomer } from '../../src/lib/customer/session'
import { getAccountDashboard } from '../../src/lib/customer/account-dashboard'
import { logoutCustomerAction } from '../../src/lib/customer/actions'
import { removeAccountFavoriteAction } from '../../src/lib/customer/wishlist-actions'
import { removeSavedSearchAction } from '../../src/lib/customer/saved-search-actions'
import { cancelProductInterestAction } from '../../src/lib/customer/product-interest-actions'
import { buildSavedSearchUrl } from '../../src/lib/customer/saved-search'
import { customerOrderStatusLabel } from '../../src/lib/customer/order-display'
import { deliveryMethodLabel, paymentMethodLabel } from '../../src/lib/orders/methods'
import { formatPrice } from '../../src/lib/catalog'
import OpenLoginButton from './_components/OpenLoginButton'
import ProfileForm from './_components/ProfileForm'
import PasswordForm from './_components/PasswordForm'
import EmailVerification from './_components/EmailVerification'

export const metadata: Metadata = {
  title: 'Особистий кабінет — AURELIA',
  description: 'Особистий кабінет AURELIA: профіль, обране, збережені пошуки та історія замовлень.',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' })

const GemIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

export default async function AccountPage() {
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

  const { orders, wishlist, reviews, savedSearches, interests, engagement } =
    await getAccountDashboard(customer.id)

  return (
    <div className="au-container au-checkout">
      <h1 className="au-co-title">Особистий кабінет</h1>

      <div className="au-checkout-grid">
        {/* ---- Left: profile + security + wishlist + saved searches + interests ---- */}
        <div>
          <section className="au-co-section">
            <h2 className="au-co-section-title">Профіль</h2>
            <ul className="au-co-list">
              <li className="au-co-line">
                <div className="au-co-line-main">
                  <span className="au-co-line-meta">E-mail</span>
                  <p className="au-co-line-name">{customer.email}</p>
                  {/* Email verification status (Этап 60A) — foundation, nothing emailed. */}
                  <EmailVerification verified={customer.emailVerifiedAt !== null} />
                </div>
              </li>
              {customer.phone && (
                <li className="au-co-line">
                  <div className="au-co-line-main">
                    <span className="au-co-line-meta">Телефон</span>
                    <p className="au-co-line-name">{customer.phone}</p>
                  </div>
                </li>
              )}
              {/* Non-financial engagement label (Этап 69A) — informational only, no points/money. */}
              <li className="au-co-line">
                <div className="au-co-line-main">
                  <span className="au-co-line-meta">Статус покупця</span>
                  <p className="au-co-line-name">
                    <strong>{engagement.labelUa}</strong>
                  </p>
                  <span className="au-co-line-meta">
                    Замовлень: {orders.total} · Обране: {wishlist.total} · Відгуків: {reviews.total} ·
                    Збережені пошуки: {savedSearches.length} · Стежу за наявністю: {interests.length}
                  </span>
                </div>
              </li>
            </ul>

            {/* Editable name/phone (Этап 47B). Email stays read-only above. */}
            <ProfileForm initialName={customer.name ?? ''} initialPhone={customer.phone ?? ''} />

            <form action={logoutCustomerAction}>
              <button className="au-btn au-btn--ghost au-btn--block" type="submit">
                Вийти
              </button>
            </form>
          </section>

          <section className="au-co-section">
            <h2 className="au-co-section-title">Зміна пароля</h2>
            <PasswordForm />
          </section>

          {/* Server-side wishlist (Этап 62A): the customer's saved products, persisted in
              the DB and resolved to PUBLISHED products only. Remove is a server action. */}
          <section className="au-co-section">
            <h2 className="au-co-section-title">
              Обране
              {wishlist.total > 0 && <span className="au-co-summary-count">{wishlist.total}</span>}
            </h2>

            {wishlist.recent.length === 0 ? (
              <p className="au-co-empty-sub">
                Поки порожньо. Позначайте прикраси сердечком — вони збережуться тут.
              </p>
            ) : (
              <ul className="au-co-list">
                {wishlist.recent.map((product) => (
                  <li className="au-co-line" key={product.slug}>
                    <div className="au-co-line-main">
                      <p className="au-co-line-name">
                        <Link href={`/product/${encodeURIComponent(product.slug)}`}>
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
              <Link href="/favorites">Уся сторінка «Обране»</Link>
            </p>
          </section>

          {/* Saved catalog searches (Этап 69A): convenience bookmarks of catalog filters.
              Each rebuilds a safe in-app /search or /category link from validated fields. */}
          <section className="au-co-section">
            <h2 className="au-co-section-title">
              Збережені пошуки
              {savedSearches.length > 0 && <span className="au-co-summary-count">{savedSearches.length}</span>}
            </h2>

            {savedSearches.length === 0 ? (
              <p className="au-co-empty-sub">
                Збережіть зручні фільтри каталогу (ціна, матеріал, сортування) — і повертайтесь
                до них одним кліком. Кнопка «Зберегти пошук» зʼявляється у каталозі та пошуку.
              </p>
            ) : (
              <ul className="au-co-list">
                {savedSearches.map((s) => (
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

          {/* Product-interest tracking (Этап 69A): "повідомити, коли буде доступно". HONEST —
              nothing is emailed (no provider); this only records interest for the store owner. */}
          <section className="au-co-section">
            <h2 className="au-co-section-title">
              Стежу за наявністю
              {interests.length > 0 && <span className="au-co-summary-count">{interests.length}</span>}
            </h2>

            {interests.length === 0 ? (
              <p className="au-co-empty-sub">
                Якщо прикраса зараз недоступна, натисніть «Повідомити, коли буде доступно» на її
                сторінці — і вона зʼявиться тут. Листи поки не надсилаються (поштовий сервіс не
                підключено) — це лише ваш список очікування.
              </p>
            ) : (
              <>
                <ul className="au-co-list">
                  {interests.map((i) => (
                    <li className="au-co-line" key={i.id}>
                      <div className="au-co-line-main">
                        <p className="au-co-line-name">
                          <Link href={`/product/${encodeURIComponent(i.productSlug)}`}>
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
                <p className="au-co-info-link">
                  Листи-сповіщення поки не надсилаються — поштовий сервіс не підключено.
                </p>
              </>
            )}
          </section>
        </div>

        {/* ---- Right: order history + reviews summary ---- */}
        <aside className="au-co-summary">
          <h2 className="au-co-section-title">
            Мої замовлення{orders.total > 0 && <span className="au-co-summary-count">{orders.total}</span>}
          </h2>

          {orders.recent.length === 0 ? (
            <p className="au-co-empty-sub">
              У вас ще немає замовлень. Оформіть перше — і воно зʼявиться тут.
            </p>
          ) : (
            <ul className="au-co-list">
              {orders.recent.map((order) => (
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

          <p className="au-co-info-link">
            <Link href="/category/bijouterie">До каталогу</Link>
          </p>

          {/* Reviews summary (Этап 69A): the customer's OWN moderation status, safe to show. */}
          <h2 className="au-co-section-title">
            Мої відгуки{reviews.total > 0 && <span className="au-co-summary-count">{reviews.total}</span>}
          </h2>
          {reviews.total === 0 ? (
            <p className="au-co-empty-sub">
              Ви ще не залишали відгуків. Поділіться враженням на сторінці прикраси — після
              модерації відгук зʼявиться публічно.
            </p>
          ) : (
            <ul className="au-co-list">
              <li className="au-co-line">
                <div className="au-co-line-main">
                  <span className="au-co-line-meta">Опубліковано</span>
                  <p className="au-co-line-name">{reviews.approved}</p>
                </div>
              </li>
              <li className="au-co-line">
                <div className="au-co-line-main">
                  <span className="au-co-line-meta">На модерації</span>
                  <p className="au-co-line-name">{reviews.pending}</p>
                </div>
              </li>
              {reviews.rejected > 0 && (
                <li className="au-co-line">
                  <div className="au-co-line-main">
                    <span className="au-co-line-meta">Відхилено</span>
                    <p className="au-co-line-name">{reviews.rejected}</p>
                  </div>
                </li>
              )}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
