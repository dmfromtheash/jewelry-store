# QA Notes

## Bootstrap Verification

For this stage, verify:

- required documents exist;
- no application code was added;
- no dependencies were installed;
- no `.env` file was created;
- Git status is clean after commit and push.

## Future QA Strategy

- Smoke tests for the main user path.
- Manual user path verification before each release.
- Accessibility checks for keyboard, focus, labels, contrast, and motion.
- Performance checks for image weight, layout shift, and responsiveness.
- Security checks for secrets, checkout, auth, admin, uploads, and price handling.
- Regression checks before each commit and push.

## Future Manual Smoke Test

When the app exists, use this path:

1. Open home.
2. Open catalog.
3. Apply a filter.
4. Open a product.
5. Add to wishlist.
6. Add to cart.
7. Open checkout demo.
8. Trigger validation.
9. Complete checkout demo.
10. Confirm success state.
