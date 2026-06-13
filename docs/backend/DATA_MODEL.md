# AURELIA — Data Model (Этап 14A)

> Specification only. Field types are conceptual (not Prisma yet). "Now" =
> where the value comes from today (mock/localStorage). Each entity lists
> **required**, **later**, and **source today**.

Conventions: every persisted entity has `id` (uuid/cuid), `createdAt`,
`updatedAt` unless noted. Money is stored as **integer minor units (kopecks)** or
`Decimal` — never floating point. Currency is `RUB` for now.

Current mock `Product` shape (`src/lib/catalog/types.ts`) for reference:
`slug, name, category, categorySlug, status, price?, sku?, brand?, coatings?,
description?, specs?, tag?, tagGold?, rating?, reviewsCount?`.

---

## Product
The core catalog item.

- **Required:** `id`, `slug` (unique), `name`, `categoryId` (FK), `status`
  (`available` | `coming-soon`), `currency`.
- **Pricing:** `price` (integer minor units, nullable for coming-soon). Price is
  **server-authoritative**.
- **Later:** `brand`, `description`, `tag`, `tagGold`, `rating`, `reviewsCount`,
  `sku` (or move sku to variant), `seoTitle`, `seoDescription`, `publishedAt`,
  `archivedAt`.
- **Relations:** `category` (M:1), `variants` (1:M), `images` (1:M),
  `favorites` (1:M), `orderItems` (1:M, via slug/snapshot).
- **Source now:** `src/data/products.ts`.

## Category
Top-level grouping; today only `bijouterie` and `gifts`.

- **Required:** `id`, `slug` (unique), `name`.
- **Later:** `parentId` (self-relation for sub-categories like Серьги/Кольца),
  `sortOrder`, `description`, `bannerImageId`.
- **Relations:** `products` (1:M), optional self `parent`/`children`.
- **Source now:** derived from `categorySlug` on mock products + hardcoded labels.

## ProductVariant
Selectable option (today: coating — Позолота/Родирование/Сталь).

- **Required:** `id`, `productId` (FK), `name` (e.g. coating), `value`.
- **Later:** `priceDelta`, `sku`, `inventoryQty`, `isDefault`, `attributes`
  (size, etc.).
- **Relations:** `product` (M:1), `inventory` (1:1 later).
- **Source now:** `Product.coatings: string[]` (flat list, no pricing).

## ProductImage (placeholder)
Image slots; **no real images yet** (UI shows gem placeholder).

- **Required:** `id`, `productId` (FK), `position`.
- **Later:** `url`, `alt`, `width`, `height`, `isPrimary`, storage key.
- **Relations:** `product` (M:1).
- **Source now:** none — UI renders a static placeholder.

## User
Customer account.

- **Required:** `id`, `email` (unique), `passwordHash` (or external auth id),
  `createdAt`.
- **Later:** `emailVerifiedAt`, `name`, `phone`, `status` (active/blocked),
  `lastLoginAt`.
- **Relations:** `profile` (1:1), `addresses` (1:M), `favorites` (1:M),
  `carts` (1:M), `orders` (1:M).
- **Source now:** none — auth is UI-only (login/register modals don't persist).

## Favorite
Wishlist entry.

- **Required:** `id`, `userId` (FK), `productId` (FK), unique(`userId`,`productId`).
- **Later:** `createdAt` for ordering.
- **Relations:** `user` (M:1), `product` (M:1).
- **Source now:** `localStorage aurelia-favorites` (`slug[]`). On login, merge
  local slugs into the user's favorites.

## Cart
A cart belongs either to a guest (session/cookie id) or a user.

- **Required:** `id`, one of `userId` (FK) **or** `guestToken` (opaque cookie),
  `currency`, `status` (`active` | `ordered` | `abandoned`).
- **Later:** `expiresAt`, merge bookkeeping.
- **Relations:** `items` (1:M), `user` (M:1 optional).
- **Source now:** `localStorage aurelia-cart` (`{slug, qty}[]`).

## CartItem
Line in a cart.

- **Required:** `id`, `cartId` (FK), `productId` (FK), `qty` (>=1).
- **Later:** `variantId`, `unitPriceSnapshot` (optional; price is normally
  recomputed live from `Product`).
- **Relations:** `cart` (M:1), `product` (M:1), `variant` (M:1 later).
- **Constraint:** unique(`cartId`,`productId`,`variantId`).
- **Source now:** entries inside `localStorage aurelia-cart`.

## Order
A placed order (created from a cart at checkout). **Immutable snapshots.**

- **Required:** `id`, `number` (human-readable), `status`
  (`draft` | `pending` | `paid` | `cancelled` | `fulfilled`),
  `userId` **or** guest contact, `currency`, `subtotal`, `total`,
  `contactName`, `contactPhone`, `contactEmail`, `placedAt`.
- **Later:** `shippingAddressId`, `deliveryMethod`, `deliveryCost`, `discount`,
  `couponCode`, `note`, `paymentId`.
- **Relations:** `items` (1:M), `user` (M:1 optional), `payment` (1:1 later),
  `address` (M:1 later).
- **Source now:** none — checkout is a demo that does not submit.

## OrderItem
Line in an order — **snapshots** name/price at purchase time.

- **Required:** `id`, `orderId` (FK), `productId` (FK, nullable if product later
  deleted), `nameSnapshot`, `unitPrice`, `qty`, `lineTotal`.
- **Later:** `variantSnapshot`, `skuSnapshot`, `imageSnapshot`.
- **Relations:** `order` (M:1).
- **Source now:** none.

## CustomerProfile
Extended user info.

- **Required:** `id`, `userId` (FK, unique).
- **Later:** `firstName`, `lastName`, `phone`, `birthday`, `marketingOptIn`.
- **Relations:** `user` (1:1).
- **Source now:** none.

## Address
Delivery address.

- **Required:** `id`, `userId` (FK), `city`.
- **Later:** `recipientName`, `phone`, `street`, `house`, `flat`, `postalCode`,
  `region`, `isDefault`.
- **Relations:** `user` (M:1), `orders` (1:M).
- **Source now:** checkout city/contact inputs are uncontrolled, not stored.

## Payment (placeholder)
Records intent; **no real gateway in the first cycle**.

- **Required:** `id`, `orderId` (FK, unique), `status` (`placeholder` | `pending`
  | `paid` | `failed`), `amount`, `currency`.
- **Later:** `provider`, `providerIntentId`, `method`, `paidAt`, raw provider
  payload (encrypted / minimal).
- **Relations:** `order` (1:1).
- **Source now:** none — checkout shows "оплата будет подключена позже".

## AdminUser / Role
Staff access — kept **separate** from customer `User`.

- **Required:** `id`, `email` (unique), `passwordHash`, `role`
  (`owner` | `admin` | `manager`).
- **Later:** `isActive`, `lastLoginAt`, granular `permissions`.
- **Relations:** `auditLogs` (1:M).
- **Source now:** none.
- **Note:** roles gate admin CRUD (products) and order management.

## AuditLog (admin)
Append-only record of admin actions (security requirement).

- **Required:** `id`, `actorAdminId`, `action`, `entityType`, `entityId`,
  `createdAt`.
- **Later:** `diff` (before/after), `ip`, `userAgent`.
- **Source now:** none.

## InfoPage (deferred / optional backend)
Content for `delivery/returns/stores/help/about/contacts`.

- **Decision:** keep as **static code** (`src/data/info-pages.ts`) for now.
- **Later (optional):** move to DB/CMS with `slug`, `title`, `sections` (JSON),
  `metaTitle`, `metaDescription`, `publishedAt` if non-developers must edit copy.
- **Source now:** `src/data/info-pages.ts`.

---

### Relationship summary

```
Category 1───* Product 1───* ProductVariant
                  │   └──* ProductImage
User 1───1 CustomerProfile
User 1───* Address
User 1───* Favorite *───1 Product
User 1───* Cart 1───* CartItem *───1 Product
User 1───* Order 1───* OrderItem
Order 1───1 Payment
AdminUser 1───* AuditLog
```
