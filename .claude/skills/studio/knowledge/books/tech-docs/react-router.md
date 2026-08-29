# React Router v7 — Official Docs

Author: Remix team / React Router contributors
Source: https://github.com/remix-run/react-router
Branch: main
Fetched: 2026-05-17T09:46:05.125Z
Pages: 206

---

## Page 1 — `docs/api/components/Await.md`

Live URL: https://reactrouter.com/api/components/Await

# Await
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.Await.html)
Used to render promise values with automatic error handling.
**Note:** `<Await>` expects to be rendered inside a [`<React.Suspense>`](https://react.dev/reference/react/Suspense)
```tsx
export async function loader() {
  // not awaited
  const reviews = getReviews();
  // awaited (blocks the transition)
  const book = await fetch("/api/book").then((res) => res.json());
  return { book, reviews };
}
function Book() {
  const { book, reviews } = useLoaderData();
  return (
    <div>
      <h1>{book.title}</h1>
      <p>{book.description}</p>
      <React.Suspense fallback={<ReviewsSkeleton />}>
        <Await
          resolve={reviews}
          errorElement={
            <div>Could not load reviews 😬</div>
          }
          children={(resolvedReviews) => (
            <Reviews items={resolvedReviews} />
          )}
        />
      </React.Suspense>
    </div>
  );
}
```
## Signature
```tsx
function Await<Resolve>({
  children,
  errorElement,
  resolve,
}: AwaitProps<Resolve>)
```
## Props
### children
When using a function, the resolved value is provided as the parameter.
```tsx [2]
<Await resolve={reviewsPromise}>
  {(resolvedReviews) => <Reviews items={resolvedReviews} />}
</Await>
```
When using React elements, [`useAsyncValue`](../hooks/useAsyncValue) will provide the
resolved value:
```tsx [2]
<Await resolve={reviewsPromise}>
  <Reviews />
</Await>
function Reviews() {
  const resolvedReviews = useAsyncValue();
  return <div>...</div>;
}
```
### errorElement
The error element renders instead of the `children` when the [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
rejects.
```tsx
<Await
  errorElement={<div>Oops</div>}
  resolve={reviewsPromise}
>
  <Reviews />
</Await>
```
To provide a more contextual error, you can use the [`useAsyncError`](../hooks/useAsyncError) in a
child component
```tsx
<Await
  errorElement={<ReviewsError />}
  resolve={reviewsPromise}
>
  <Reviews />
</Await>
function ReviewsError() {
  const error = useAsyncError();
  return <div>Error loading reviews: {error.message}</div>;
}
```
If you do not provide an `errorElement`, the rejected value will bubble up
to the nearest route-level [`ErrorBoundary`](../../start/framework/route-module#errorboundary)
and be accessible via the [`useRouteError`](../hooks/useRouteError) hook.
### resolve
Takes a [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
returned from a [`loader`](../../start/framework/route-module#loader) to be
resolved and rendered.
```tsx
export async function loader() {
  let reviews = getReviews(); // not awaited
  let book = await getBook();
  return {
    book,
    reviews, // this is a promise
  };
}
export default function Book() {
  const {
    book,
    reviews, // this is the same promise
  } = useLoaderData();
  return (
    <div>
      <h1>{book.title}</h1>
      <p>{book.description}</p>
      <React.Suspense fallback={<ReviewsSkeleton />}>
        <Await
          // and is the promise we pass to Await
          resolve={reviews}
        >
          <Reviews />
        </Await>
      </React.Suspense>
    </div>
  );
}
```

---

## Page 2 — `docs/api/components/Form.md`

Live URL: https://reactrouter.com/api/components/Form

# Form
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.Form.html)
A progressively enhanced HTML [`<form>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form)
that submits data to actions via [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/fetch),
activating pending states in [`useNavigation`](../hooks/useNavigation) which enables advanced
user interfaces beyond a basic HTML [`<form>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form).
After a form's `action` completes, all data on the page is automatically
revalidated to keep the UI in sync with the data.
Because it uses the HTML form API, server rendered pages are interactive at a
basic level before JavaScript loads. Instead of React Router managing the
submission, the browser manages the submission as well as the pending states
(like the spinning favicon). After JavaScript loads, React Router takes over
enabling web application user experiences.
`Form` is most useful for submissions that should also change the URL or
otherwise add an entry to the browser history stack. For forms that shouldn't
manipulate the browser [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
stack, use [`<fetcher.Form>`](https://api.reactrouter.com/v7/types/react-router.FetcherWithComponents.html#Form).
```tsx
function NewEvent() {
  return (
    <Form action="/events" method="post">
      <input name="title" type="text" />
      <input name="description" type="text" />
    </Form>
  );
}
```
## Props
### action
The URL to submit the form data to. If `undefined`, this defaults to the
closest route in context.
### discover
Defines the form [lazy route discovery](../../explanation/lazy-route-discovery) behavior.
- **render** — default, discover the route when the form renders
- **none** — don't eagerly discover, only discover if the form is submitted
```tsx
<Form /> // default ("render")
<Form discover="render" />
<Form discover="none" />
```
### encType
The encoding type to use for the form submission.
```tsx
<Form encType="application/x-www-form-urlencoded"/>  // Default
<Form encType="multipart/form-data"/>
<Form encType="text/plain"/>
```
### fetcherKey
Indicates a specific fetcherKey to use when using `navigate={false}` so you
can pick up the fetcher's state in a different component in a [`useFetcher`](../hooks/useFetcher).
### method
The HTTP verb to use when the form is submitted. Supports `"delete"`,
`"get"`, `"patch"`, `"post"`, and `"put"`.
Native [`<form>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form)
only supports `"get"` and `"post"`, avoid the other verbs if you'd like to
support progressive enhancement
### navigate
When `false`, skips the navigation and submits via a fetcher internally.
This is essentially a shorthand for [`useFetcher`](../hooks/useFetcher) + `<fetcher.Form>` where
you don't care about the resulting data in this component.
### onSubmit
A function to call when the form is submitted. If you call
[`event.preventDefault()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
then this form will not do anything.
### preventScrollReset
Prevent the scroll position from resetting to the top of the viewport on
completion of the navigation when using the
``<ScrollRestoration>`` component
### relative
Determines whether the form action is relative to the route hierarchy or
the pathname. Use this if you want to opt out of navigating the route
hierarchy and want to instead route based on slash-delimited URL segments.
See [`RelativeRoutingType`](https://api.reactrouter.com/v7/types/react-router.RelativeRoutingType.html).
### reloadDocument
Forces a full document navigation instead of client side routing and data
fetch.
### replace
Replaces the current entry in the browser [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
stack when the form navigates. Use this if you don't want the user to be
able to click "back" to the page with the form on it.
### state
State object to add to the [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
stack entry for this navigation
### viewTransition
Enables a [View Transition](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)
for this navigation. To apply specific styles during the transition, see
[`useViewTransitionState`](../hooks/useViewTransitionState).
### defaultShouldRevalidate
Specify the default revalidation behavior after this submission
If no `shouldRevalidate` functions are present on the active routes, then this
value will be used directly.  Otherwise it will be passed into `shouldRevalidate`
so the route can make the final determination on revalidation. This can be
useful when updating search params and you don't want to trigger a revalidation.
By default (when not specified), loaders will revalidate according to the routers
standard revalidation behavior.

---

## Page 3 — `docs/api/components/Link.md`

Live URL: https://reactrouter.com/api/components/Link

# Link
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.Link.html)
A progressively enhanced [`<a href>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a)
wrapper to enable navigation with client-side routing.
```tsx
<Link to="/dashboard">Dashboard</Link>;
<Link
  to={{
    pathname: "/some/path",
    search: "?query=string",
    hash: "#hash",
  }}
/>;
```
## Props
### discover
[modes: framework]
Defines the link [lazy route discovery](../../explanation/lazy-route-discovery) behavior.
- **render** — default, discover the route when the link renders
- **none** — don't eagerly discover, only discover if the link is clicked
```tsx
<Link /> // default ("render")
<Link discover="render" />
<Link discover="none" />
```
### prefetch
[modes: framework]
Defines the data and module prefetching behavior for the link.
```tsx
<Link /> // default
<Link prefetch="none" />
<Link prefetch="intent" />
<Link prefetch="render" />
<Link prefetch="viewport" />
```
- **none** — default, no prefetching
- **intent** — prefetches when the user hovers or focuses the link
- **render** — prefetches when the link renders
- **viewport** — prefetches when the link is in the viewport, very useful for mobile
Prefetching is done with HTML [`<link rel="prefetch">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link)
tags. They are inserted after the link.
```tsx
<a href="..." />
<a href="..." />
<link rel="prefetch" /> // might conditionally render
```
Because of this, if you are using `nav :last-child` you will need to use
`nav :last-of-type` so the styles don't conditionally fall off your last link
(and any other similar selectors).
### preventScrollReset
[modes: framework, data]
Prevents the scroll position from being reset to the top of the window when
the link is clicked and the app is using [`ScrollRestoration`](../components/ScrollRestoration). This only
prevents new locations resetting scroll to the top, scroll position will be
restored for back/forward button navigation.
```tsx
<Link to="?tab=one" preventScrollReset />
```
### relative
[modes: framework, data, declarative]
Defines the relative path behavior for the link.
```tsx
<Link to=".." /> // default: "route"
<Link relative="route" />
<Link relative="path" />
```
Consider a route hierarchy where a parent route pattern is `"blog"` and a child
route pattern is `"blog/:slug/edit"`.
- **route** — default, resolves the link relative to the route pattern. In the
example above, a relative link of `"..."` will remove both `:slug/edit` segments
back to `"/blog"`.
- **path** — relative to the path so `"..."` will only remove one URL segment up
to `"/blog/:slug"`
Note that index routes and layout routes do not have paths so they are not
included in the relative path calculation.
### reloadDocument
[modes: framework, data, declarative]
Will use document navigation instead of client side routing when the link is
clicked: the browser will handle the transition normally (as if it were an
[`<a href>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a)).
```tsx
<Link to="/logout" reloadDocument />
```
### replace
[modes: framework, data, declarative]
Replaces the current entry in the [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
stack instead of pushing a new one onto it.
```tsx
<Link replace />
```
```
# with a history stack like this
A -> B
# normal link click pushes a new entry
A -> B -> C
# but with `replace`, B is replaced by C
A -> C
```
### state
[modes: framework, data, declarative]
Adds persistent client side routing state to the next location.
```tsx
<Link to="/somewhere/else" state={{ some: "value" }} />
```
The location state is accessed from the `location`.
```tsx
function SomeComp() {
  const location = useLocation();
  location.state; // { some: "value" }
}
```
This state is inaccessible on the server as it is implemented on top of
[`history.state`](https://developer.mozilla.org/en-US/docs/Web/API/History/state)
### to
[modes: framework, data, declarative]
Can be a string or a partial [`Path`](https://api.reactrouter.com/v7/interfaces/react-router.Path.html):
```tsx
<Link to="/some/path" />
<Link
  to={{
    pathname: "/some/path",
    search: "?query=string",
    hash: "#hash",
  }}
/>
```
### viewTransition
[modes: framework, data]
Enables a [View Transition](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)
for this navigation.
```jsx
<Link to={to} viewTransition>
  Click me
</Link>
```
To apply specific styles for the transition, see [`useViewTransitionState`](../hooks/useViewTransitionState)
### defaultShouldRevalidate
[modes: framework, data, declarative]
Specify the default revalidation behavior for the navigation.
```tsx
<Link to="/some/path" defaultShouldRevalidate={false} />
```
If no `shouldRevalidate` functions are present on the active routes, then this
value will be used directly.  Otherwise it will be passed into `shouldRevalidate`
so the route can make the final determination on revalidation. This can be
useful when updating search params and you don't want to trigger a revalidation.
By default (when not specified), loaders will revalidate according to the routers
standard revalidation behavior.
### mask
[modes: framework, data]
Masked path for this navigation, when you want to navigate the router to
one location but display a separate location in the URL bar.
This is useful for contextual navigations such as opening an image in a modal
on top of a gallery while keeping the underlying gallery active. If a user
shares the masked URL, or opens the link in a new tab, they will only load
the masked location without the underlying contextual location.
This feature relies on `history.state` and is thus only intended for SPA uses
and SSR renders will not respect the masking.
```tsx
// routes/gallery.tsx
export function clientLoader({ request }: Route.LoaderArgs) {
  let sp = new URL(request.url).searchParams;
  return {
    images: getImages(),
    modalImage: sp.has("image") ? getImage(sp.get("image")!) : null,
  };
}
export default function Gallery({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <GalleryGrid>
       {loaderData.images.map((image) => (
         <Link
           key={image.id}
           to={`/gallery?image=${image.id}`}
           mask={`/images/${image.id}`}
         >
           <img src={image.url} alt={image.alt} />
         </Link>
       ))}
      </GalleryGrid>
      {data.modalImage ? (
        <dialog open>
          <img src={data.modalImage.url} alt={data.modalImage.alt} />
        </dialog>
      ) : null}
    </>
  );
}
```

---

## Page 4 — `docs/api/components/Links.md`

Live URL: https://reactrouter.com/api/components/Links

# Links
[MODES: framework]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.Links.html)
Renders all the [`<link>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link)
tags created by the route module's [`links`](../../start/framework/route-module#links)
export. You should render it inside the [`<head>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/head)
of your document.
```tsx
export default function Root() {
  return (
    <html>
      <head>
        <Links />
      </head>
      <body></body>
    </html>
  );
}
```
## Signature
```tsx
function Links({ nonce, crossOrigin }: LinksProps): React.JSX.Element
```
## Props
### nonce
A [`nonce`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/nonce)
attribute to render on the [`<link>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link)
element
### crossOrigin
A [`crossOrigin`](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin)
attribute to render on the [`<link>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link)
element

---

## Page 5 — `docs/api/components/Meta.md`

Live URL: https://reactrouter.com/api/components/Meta

# Meta
[MODES: framework]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.Meta.html)
Renders all the [`<meta>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta)
tags created by the route module's [`meta`](../../start/framework/route-module#meta)
export. You should render it inside the [`<head>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/head)
of your document.
```tsx
export default function Root() {
  return (
    <html>
      <head>
        <Meta />
      </head>
    </html>
  );
}
```
## Signature
```tsx
function Meta(): React.JSX.Element
```

---

## Page 6 — `docs/api/components/NavLink.md`

Live URL: https://reactrouter.com/api/components/NavLink

# NavLink
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.NavLink.html)
Wraps [`<Link>`](../components/Link) with additional props for styling active and
pending states.
- Automatically applies classes to the link based on its `active` and `pending`
states, see [`NavLinkProps.className`](https://api.reactrouter.com/v7/interfaces/react-router.NavLinkProps.html#className)
  - Note that `pending` is only available with Framework and Data modes.
- Automatically applies `aria-current="page"` to the link when the link is active.
See [`aria-current`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-current)
on MDN.
- States are additionally available through the className, style, and children
render props. See [`NavLinkRenderProps`](https://api.reactrouter.com/v7/types/react-router.NavLinkRenderProps.html).
```tsx
<NavLink to="/message">Messages</NavLink>
// Using render props
<NavLink
  to="/messages"
  className={({ isActive, isPending }) =>
    isPending ? "pending" : isActive ? "active" : ""
  }
>
  Messages
</NavLink>
```
## Props
### caseSensitive
[modes: framework, data, declarative]
Changes the matching logic to make it case-sensitive:
| Link                                         | URL           | isActive |
| -------------------------------------------- | ------------- | -------- |
| `<NavLink to="/SpOnGe-bOB" />`               | `/sponge-bob` | true     |
| `<NavLink to="/SpOnGe-bOB" caseSensitive />` | `/sponge-bob` | false    |
### children
[modes: framework, data, declarative]
Can be regular React children or a function that receives an object with the
`active` and `pending` states of the link.
 ```tsx
 <NavLink to="/tasks">
   {({ isActive }) => (
     <span className={isActive ? "active" : ""}>Tasks</span>
   )}
 </NavLink>
 ```
### className
[modes: framework, data, declarative]
Classes are automatically applied to `NavLink` that correspond to the state.
```css
a.active {
  color: red;
}
a.pending {
  color: blue;
}
a.transitioning {
  view-transition-name: my-transition;
}
```
Or you can specify a function that receives [`NavLinkRenderProps`](https://api.reactrouter.com/v7/types/react-router.NavLinkRenderProps.html) and
returns the `className`:
```tsx
<NavLink className={({ isActive, isPending }) => (
  isActive ? "my-active-class" :
  isPending ? "my-pending-class" :
  ""
)} />
```
### discover
[modes: framework]
Defines the link [lazy route discovery](../../explanation/lazy-route-discovery) behavior.
- **render** — default, discover the route when the link renders
- **none** — don't eagerly discover, only discover if the link is clicked
```tsx
<Link /> // default ("render")
<Link discover="render" />
<Link discover="none" />
```
### end
[modes: framework, data, declarative]
Changes the matching logic for the `active` and `pending` states to only match
to the "end" of the [`NavLinkProps.to`](https://api.reactrouter.com/v7/interfaces/react-router.NavLinkProps.html#to). If the URL is longer, it will no
longer be considered active.
| Link                          | URL          | isActive |
| ----------------------------- | ------------ | -------- |
| `<NavLink to="/tasks" />`     | `/tasks`     | true     |
| `<NavLink to="/tasks" />`     | `/tasks/123` | true     |
| `<NavLink to="/tasks" end />` | `/tasks`     | true     |
| `<NavLink to="/tasks" end />` | `/tasks/123` | false    |
`<NavLink to="/">` is an exceptional case because _every_ URL matches `/`.
To avoid this matching every single route by default, it effectively ignores
the `end` prop and only matches when you're at the root route.
### prefetch
[modes: framework]
Defines the data and module prefetching behavior for the link.
```tsx
<Link /> // default
<Link prefetch="none" />
<Link prefetch="intent" />
<Link prefetch="render" />
<Link prefetch="viewport" />
```
- **none** — default, no prefetching
- **intent** — prefetches when the user hovers or focuses the link
- **render** — prefetches when the link renders
- **viewport** — prefetches when the link is in the viewport, very useful for mobile
Prefetching is done with HTML [`<link rel="prefetch">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link)
tags. They are inserted after the link.
```tsx
<a href="..." />
<a href="..." />
<link rel="prefetch" /> // might conditionally render
```
Because of this, if you are using `nav :last-child` you will need to use
`nav :last-of-type` so the styles don't conditionally fall off your last link
(and any other similar selectors).
### preventScrollReset
[modes: framework, data]
Prevents the scroll position from being reset to the top of the window when
the link is clicked and the app is using [`ScrollRestoration`](../components/ScrollRestoration). This only
prevents new locations resetting scroll to the top, scroll position will be
restored for back/forward button navigation.
```tsx
<Link to="?tab=one" preventScrollReset />
```
### relative
[modes: framework, data, declarative]
Defines the relative path behavior for the link.
```tsx
<Link to=".." /> // default: "route"
<Link relative="route" />
<Link relative="path" />
```
Consider a route hierarchy where a parent route pattern is `"blog"` and a child
route pattern is `"blog/:slug/edit"`.
- **route** — default, resolves the link relative to the route pattern. In the
example above, a relative link of `"..."` will remove both `:slug/edit` segments
back to `"/blog"`.
- **path** — relative to the path so `"..."` will only remove one URL segment up
to `"/blog/:slug"`
Note that index routes and layout routes do not have paths so they are not
included in the relative path calculation.
### reloadDocument
[modes: framework, data, declarative]
Will use document navigation instead of client side routing when the link is
clicked: the browser will handle the transition normally (as if it were an
[`<a href>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a)).
```tsx
<Link to="/logout" reloadDocument />
```
### replace
[modes: framework, data, declarative]
Replaces the current entry in the [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
stack instead of pushing a new one onto it.
```tsx
<Link replace />
```
```
# with a history stack like this
A -> B
# normal link click pushes a new entry
A -> B -> C
# but with `replace`, B is replaced by C
A -> C
```
### state
[modes: framework, data, declarative]
Adds persistent client side routing state to the next location.
```tsx
<Link to="/somewhere/else" state={{ some: "value" }} />
```
The location state is accessed from the `location`.
```tsx
function SomeComp() {
  const location = useLocation();
  location.state; // { some: "value" }
}
```
This state is inaccessible on the server as it is implemented on top of
[`history.state`](https://developer.mozilla.org/en-US/docs/Web/API/History/state)
### style
[modes: framework, data, declarative]
Styles can also be applied dynamically via a function that receives
[`NavLinkRenderProps`](https://api.reactrouter.com/v7/types/react-router.NavLinkRenderProps.html) and returns the styles:
```tsx
<NavLink to="/tasks" style={{ color: "red" }} />
<NavLink to="/tasks" style={({ isActive, isPending }) => ({
  color:
    isActive ? "red" :
    isPending ? "blue" : "black"
})} />
```
### to
[modes: framework, data, declarative]
Can be a string or a partial [`Path`](https://api.reactrouter.com/v7/interfaces/react-router.Path.html):
```tsx
<Link to="/some/path" />
<Link
  to={{
    pathname: "/some/path",
    search: "?query=string",
    hash: "#hash",
  }}
/>
```
### viewTransition
[modes: framework, data]
Enables a [View Transition](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)
for this navigation.
```jsx
<Link to={to} viewTransition>
  Click me
</Link>
```
To apply specific styles for the transition, see [`useViewTransitionState`](../hooks/useViewTransitionState)

---

## Page 7 — `docs/api/components/Navigate.md`

Live URL: https://reactrouter.com/api/components/Navigate

# Navigate
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.Navigate.html)
A component-based version of [`useNavigate`](../hooks/useNavigate) to use in a
[`React.Component` class](https://react.dev/reference/react/Component) where
hooks cannot be used.
It's recommended to avoid using this component in favor of [`useNavigate`](../hooks/useNavigate).
```tsx
<Navigate to="/tasks" />
```
## Signature
```tsx
function Navigate({ to, replace, state, relative }: NavigateProps): null
```
## Props
### relative
How to interpret relative routing in the `to` prop.
See [`RelativeRoutingType`](https://api.reactrouter.com/v7/types/react-router.RelativeRoutingType.html).
### replace
Whether to replace the current entry in the [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
stack
### state
State to pass to the new [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html) to store in [`history.state`](https://developer.mozilla.org/en-US/docs/Web/API/History/state).
### to
The path to navigate to. This can be a string or a [`Path`](https://api.reactrouter.com/v7/interfaces/react-router.Path.html) object

---

## Page 8 — `docs/api/components/Outlet.md`

Live URL: https://reactrouter.com/api/components/Outlet

# Outlet
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.Outlet.html)
Renders the matching child route of a parent route or nothing if no child
route matches.
```tsx
export default function SomeParent() {
  return (
    <div>
      <h1>Parent Content</h1>
      <Outlet />
    </div>
  );
}
```
## Signature
```tsx
function Outlet(props: OutletProps): React.ReactElement | null
```
## Props
### context
Provides a context value to the element tree below the outlet. Use when
the parent route needs to provide values to child routes.
```tsx
<Outlet context={myContextValue} />
```
Access the context with [`useOutletContext`](../hooks/useOutletContext).

---

## Page 9 — `docs/api/components/PrefetchPageLinks.md`

Live URL: https://reactrouter.com/api/components/PrefetchPageLinks

# PrefetchPageLinks
[MODES: framework]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.PrefetchPageLinks.html)
Renders [`<link rel=prefetch|modulepreload>`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/rel)
tags for modules and data of another page to enable an instant navigation to
that page. [`<Link prefetch>`](./Link#prefetch) uses this internally, but you
can render it to prefetch a page for any other reason.
For example, you may render one of this as the user types into a search field
to prefetch search results before they click through to their selection.
```tsx
<PrefetchPageLinks page="/absolute/path" />
```
## Signature
```tsx
function PrefetchPageLinks({ page, ...linkProps }: PageLinkDescriptor)
```
## Props
### page
The absolute path of the page to prefetch, e.g. `/absolute/path`.
### linkProps
Additional props to spread onto the [`<link>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link) tags, such as [`crossOrigin`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/crossOrigin),
[`integrity`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/integrity),
[`rel`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLinkElement/rel),
etc.

---

## Page 10 — `docs/api/components/Route.md`

Live URL: https://reactrouter.com/api/components/Route

# Route
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.Route.html)
Configures an element to render when a pattern matches the current location.
It must be rendered within a [`Routes`](../components/Routes) element. Note that these routes
do not participate in data loading, actions, code splitting, or any other
route module features.
```tsx
// Usually used in a declarative router
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<StepOne />} />
        <Route path="step-2" element={<StepTwo />} />
        <Route path="step-3" element={<StepThree />} />
      </Routes>
   </BrowserRouter>
  );
}
// But can be used with a data router as well if you prefer the JSX notation
const routes = createRoutesFromElements(
  <>
    <Route index loader={step1Loader} Component={StepOne} />
    <Route path="step-2" loader={step2Loader} Component={StepTwo} />
    <Route path="step-3" loader={step3Loader} Component={StepThree} />
  </>
);
const router = createBrowserRouter(routes);
function App() {
  return <RouterProvider router={router} />;
}
```
## Signature
```tsx
function Route(props: RouteProps): React.ReactElement | null
```
## Props
### action
The route action.
See [`action`](../../start/data/route-object#action).
### caseSensitive
Whether the path should be case-sensitive. Defaults to `false`.
### Component
The React Component to render when this route matches.
Mutually exclusive with `element`.
### children
Child Route components
### element
The React element to render when this Route matches.
Mutually exclusive with `Component`.
### ErrorBoundary
The React Component to render at this route if an error occurs.
Mutually exclusive with `errorElement`.
### errorElement
The React element to render at this route if an error occurs.
Mutually exclusive with `ErrorBoundary`.
### handle
The route handle.
### HydrateFallback
The React Component to render while this router is loading data.
Mutually exclusive with `hydrateFallbackElement`.
### hydrateFallbackElement
The React element to render while this router is loading data.
Mutually exclusive with `HydrateFallback`.
### id
The unique identifier for this route (for use with [`DataRouter`](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html)s)
### index
Whether this is an index route.
### lazy
A function that returns a promise that resolves to the route object.
Used for code-splitting routes.
See [`lazy`](../../start/data/route-object#lazy).
### loader
The route loader.
See [`loader`](../../start/data/route-object#loader).
### path
The path pattern to match. If unspecified or empty, then this becomes a
layout route.
### shouldRevalidate
The route shouldRevalidate function.
See [`shouldRevalidate`](../../start/data/route-object#shouldRevalidate).

---

## Page 11 — `docs/api/components/Routes.md`

Live URL: https://reactrouter.com/api/components/Routes

# Routes
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.Routes.html)
Renders a branch of [`<Route>`s](../components/Route) that best matches the current
location. Note that these routes do not participate in [data loading](../../start/framework/route-module#loader),
[`action`](../../start/framework/route-module#action), code splitting, or
any other [route module](../../start/framework/route-module) features.
```tsx
<Routes>
  <Route index element={<StepOne />} />
  <Route path="step-2" element={<StepTwo />} />
  <Route path="step-3" element={<StepThree />} />
</Routes>
```
## Signature
```tsx
function Routes({
  children,
  location,
}: RoutesProps): React.ReactElement | null
```
## Props
### children
Nested [`Route`](../components/Route) elements
### location
The [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html) to match against. Defaults to the current location.

---

## Page 12 — `docs/api/components/Scripts.md`

Live URL: https://reactrouter.com/api/components/Scripts

# Scripts
[MODES: framework]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.Scripts.html)
Renders the client runtime of your app. It should be rendered inside the
[`<body>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/body)
 of the document.
If server rendering, you can omit `<Scripts/>` and the app will work as a
traditional web app without JavaScript, relying solely on HTML and browser
behaviors.
```tsx
export default function Root() {
  return (
    <html>
      <head />
      <body>
        <Scripts />
      </body>
    </html>
  );
}
```
## Signature
```tsx
function Scripts(scriptProps: ScriptsProps): React.JSX.Element | null
```
## Props
### scriptProps
Additional props to spread onto the [`<script>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) tags, such as [`crossOrigin`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/crossOrigin),
[`nonce`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/nonce),
etc.

---

## Page 13 — `docs/api/components/ScrollRestoration.md`

Live URL: https://reactrouter.com/api/components/ScrollRestoration

# ScrollRestoration
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.ScrollRestoration.html)
Emulates the browser's scroll restoration on location changes. Apps should only render one of these, right before the [`Scripts`](../components/Scripts) component.
```tsx
export default function Root() {
  return (
    <html>
      <body>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```
This component renders an inline `<script>` to prevent scroll flashing. The `nonce` prop will be passed down to the script tag to allow CSP nonce usage.
```tsx
<ScrollRestoration nonce={cspNonce} />
```
## Signature
```tsx
function ScrollRestoration({
  getKey,
  storageKey,
  ...props
}: ScrollRestorationProps)
```
## Props
### getKey
A function that returns a key to use for scroll restoration. This is useful
for custom scroll restoration logic, such as using only the pathname so
that later navigations to prior paths will restore the scroll. Defaults to
`location.key`. See [`GetScrollRestorationKeyFunction`](https://api.reactrouter.com/v7/interfaces/react-router.GetScrollRestorationKeyFunction.html).
```tsx
<ScrollRestoration
  getKey={(location, matches) => {
    // Restore based on a unique location key (default behavior)
    return location.key
    // Restore based on pathname
    return location.pathname
  }}
/>
```
### nonce
A [`nonce`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/nonce)
attribute to render on the [`<script>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script)
element
### storageKey
The key to use for storing scroll positions in [`sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage).
Defaults to `"react-router-scroll-positions"`.

---

## Page 14 — `docs/api/components/index.md`

Live URL: https://reactrouter.com/api/components/index



---

## Page 15 — `docs/api/data-routers/RouterProvider.md`

Live URL: https://reactrouter.com/api/data-routers/RouterProvider

# RouterProvider
[MODES: data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.RouterProvider.html)
Render the UI for the given [`DataRouter`](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html). This component should
typically be at the top of an app's element tree.
```tsx
const router = createBrowserRouter(routes);
createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />
);
```
<docs-info>Please note that this component is exported both from
`react-router` and `react-router/dom` with the only difference being that the
latter automatically wires up `react-dom`'s [`flushSync`](https://react.dev/reference/react-dom/flushSync)
implementation. You _almost always_ want to use the version from
`react-router/dom` unless you're running in a non-DOM environment.</docs-info>
## Signature
```tsx
function RouterProvider({
  router,
  flushSync: reactDomFlushSyncImpl,
  onError,
  useTransitions,
}: RouterProviderProps): React.ReactElement
```
## Props
### flushSync
The [`ReactDOM.flushSync`](https://react.dev/reference/react-dom/flushSync)
implementation to use for flushing updates.
You usually don't have to worry about this:
- The `RouterProvider` exported from `react-router/dom` handles this internally for you
- If you are rendering in a non-DOM environment, you can import
  `RouterProvider` from `react-router` and ignore this prop
### onError
An error handler function that will be called for any middleware, loader, action,
or render errors that are encountered in your application.  This is useful for
logging or reporting errors instead of in the `ErrorBoundary` because it's not
subject to re-rendering and will only run one time per error.
The `errorInfo` parameter is passed along from
[`componentDidCatch`](https://react.dev/reference/react/Component#componentdidcatch)
and is only present for render errors.
```tsx
<RouterProvider onError=(error, info) => {
  let { location, params, pattern, errorInfo } = info;
  console.error(error, location, errorInfo);
  reportToErrorService(error, location, errorInfo);
}} />
```
### router
The [`DataRouter`](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html) instance to use for navigation and data fetching.
### useTransitions
Control whether router state updates are internally wrapped in
[`React.startTransition`](https://react.dev/reference/react/startTransition).
- When left `undefined`, all state updates are wrapped in
  `React.startTransition`
  - This can lead to buggy behaviors if you are wrapping your own
    navigations/fetchers in `startTransition`.
- When set to `true`, [`Link`](../components/Link) and [`Form`](../components/Form) navigations will be wrapped
  in `React.startTransition` and router state changes will be wrapped in
  `React.startTransition` and also sent through
  [`useOptimistic`](https://react.dev/reference/react/useOptimistic) to
  surface mid-navigation router state changes to the UI.
- When set to `false`, the router will not leverage `React.startTransition` or
  `React.useOptimistic` on any navigations or state changes.
For more information, please see the [docs](../../explanation/react-transitions).

---

## Page 16 — `docs/api/data-routers/StaticRouterProvider.md`

Live URL: https://reactrouter.com/api/data-routers/StaticRouterProvider

# StaticRouterProvider
[MODES: data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.StaticRouterProvider.html)
A [`DataRouter`](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html) that may not navigate to any other [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html).
This is useful on the server where there is no stateful UI.
```tsx
export async function handleRequest(request: Request) {
  let { query, dataRoutes } = createStaticHandler(routes);
  let context = await query(request));
  if (context instanceof Response) {
    return context;
  }
  let router = createStaticRouter(dataRoutes, context);
  return new Response(
    ReactDOMServer.renderToString(<StaticRouterProvider ... />),
    { headers: { "Content-Type": "text/html" } }
  );
}
```
## Signature
```tsx
function StaticRouterProvider({
  context,
  router,
  hydrate = true,
  nonce,
}: StaticRouterProviderProps)
```
## Props
### context
The [`StaticHandlerContext`](https://api.reactrouter.com/v7/interfaces/react-router.StaticHandlerContext.html) returned from [`StaticHandler`](https://api.reactrouter.com/v7/interfaces/react-router.StaticHandler.html)'s
`query`
### hydrate
Whether to hydrate the router on the client (default `true`)
### nonce
The [`nonce`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/nonce)
to use for the hydration [`<script>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script)
tag
### router
The static [`DataRouter`](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html) from [`createStaticRouter`](../data-routers/createStaticRouter)

---

## Page 17 — `docs/api/data-routers/createBrowserRouter.md`

Live URL: https://reactrouter.com/api/data-routers/createBrowserRouter

# createBrowserRouter
[MODES: data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createBrowserRouter.html)
Create a new [data router](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html) that manages the application
path via [`history.pushState`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState)
and [`history.replaceState`](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState).
## Signature
```tsx
function createBrowserRouter(
  routes: RouteObject[],
  opts?: DOMRouterOpts,
): DataRouter
```
## Params
### routes
Application routes
### opts.basename
Basename path for the application.
### opts.dataStrategy
Override the default data strategy of running loaders in parallel -
see the [docs](../../how-to/data-strategy) for more information.
```tsx
let router = createBrowserRouter(routes, {
  async dataStrategy({
    matches,
    request,
    runClientMiddleware,
  }) {
    const matchesToLoad = matches.filter((m) =>
      m.shouldCallHandler(),
    );
    const results: Record<string, DataStrategyResult> = {};
    await runClientMiddleware(() =>
      Promise.all(
        matchesToLoad.map(async (match) => {
          results[match.route.id] = await match.resolve();
        }),
      ),
    );
    return results;
  },
});
```
### opts.future
Future flags to enable for the router.
### opts.getContext
A function that returns an [`RouterContextProvider`](../utils/RouterContextProvider) instance
which is provided as the `context` argument to client [`action`](../../start/data/route-object#action)s,
[`loader`](../../start/data/route-object#loader)s and [middleware](../../how-to/middleware).
This function is called to generate a fresh `context` instance on each
navigation or fetcher call.
```tsx
const apiClientContext = createContext<APIClient>();
function createBrowserRouter(routes, {
  getContext() {
    let context = new RouterContextProvider();
    context.set(apiClientContext, getApiClient());
    return context;
  }
})
```
### opts.hydrationData
When Server-Rendering and opting-out of automatic hydration, the
`hydrationData` option allows you to pass in hydration data from your
server-render. This will almost always be a subset of data from the
[`StaticHandlerContext`](https://api.reactrouter.com/v7/interfaces/react-router.StaticHandlerContext.html) value you get back from the [`StaticHandler`](https://api.reactrouter.com/v7/interfaces/react-router.StaticHandler.html)'s
`query` method:
```tsx
const router = createBrowserRouter(routes, {
  hydrationData: {
    loaderData: {
      // [routeId]: serverLoaderData
    },
    // may also include `errors` and/or `actionData`
  },
});
```
**Partial Hydration Data**
You will almost always include a complete set of `loaderData` to hydrate a
server-rendered app. But in advanced use-cases (such as Framework Mode's
[`clientLoader`](../../start/framework/route-module#clientLoader)), you may
want to include `loaderData` for only some routes that were loaded/rendered
on the server. This allows you to hydrate _some_ of the routes (such as the
app layout/shell) while showing a `HydrateFallback` component and running
the [`loader`](../../start/data/route-object#loader)s for other routes
during hydration.
A route [`loader`](../../start/data/route-object#loader) will run during
hydration in two scenarios:
 1. No hydration data is provided
    In these cases the `HydrateFallback` component will render on initial
    hydration
 2. The `loader.hydrate` property is set to `true`
    This allows you to run the [`loader`](../../start/data/route-object#loader)
    even if you did not render a fallback on initial hydration (i.e., to
    prime a cache with hydration data)
```tsx
const router = createBrowserRouter(
  [
    {
      id: "root",
      loader: rootLoader,
      Component: Root,
      children: [
        {
          id: "index",
          loader: indexLoader,
          HydrateFallback: IndexSkeleton,
          Component: Index,
        },
      ],
    },
  ],
  {
    hydrationData: {
      loaderData: {
        root: "ROOT DATA",
        // No index data provided
      },
    },
  }
);
```
### opts.instrumentations
Array of instrumentation objects allowing you to instrument the router and
individual routes prior to router initialization (and on any subsequently
added routes via `route.lazy` or `patchRoutesOnNavigation`).  This is
mostly useful for observability such as wrapping navigations, fetches,
as well as route loaders/actions/middlewares with logging and/or performance
tracing.  See the [docs](../../how-to/instrumentation) for more information.
```tsx
let router = createBrowserRouter(routes, {
  instrumentations: [logging]
});
let logging = {
  router({ instrument }) {
    instrument({
      navigate: (impl, info) => logExecution(`navigate ${info.to}`, impl),
      fetch: (impl, info) => logExecution(`fetch ${info.to}`, impl)
    });
  },
  route({ instrument, id }) {
    instrument({
      middleware: (impl, info) => logExecution(
        `middleware ${info.request.url} (route ${id})`,
        impl
      ),
      loader: (impl, info) => logExecution(
        `loader ${info.request.url} (route ${id})`,
        impl
      ),
      action: (impl, info) => logExecution(
        `action ${info.request.url} (route ${id})`,
        impl
      ),
    })
  }
};
async function logExecution(label: string, impl: () => Promise<void>) {
  let start = performance.now();
  console.log(`start ${label}`);
  await impl();
  let duration = Math.round(performance.now() - start);
  console.log(`end ${label} (${duration}ms)`);
}
```
### opts.patchRoutesOnNavigation
Lazily define portions of the route tree on navigations.
See [`PatchRoutesOnNavigationFunction`](https://api.reactrouter.com/v7/types/react-router.PatchRoutesOnNavigationFunction.html).
By default, React Router wants you to provide a full route tree up front via
`createBrowserRouter(routes)`. This allows React Router to perform synchronous
route matching, execute loaders, and then render route components in the most
optimistic manner without introducing waterfalls. The tradeoff is that your
initial JS bundle is larger by definition — which may slow down application
start-up times as your application grows.
To combat this, we introduced [`route.lazy`](../../start/data/route-object#lazy)
in [v6.9.0](https://github.com/remix-run/react-router/blob/main/CHANGELOG.md#v690)
which lets you lazily load the route _implementation_ ([`loader`](../../start/data/route-object#loader),
[`Component`](../../start/data/route-object#Component), etc.) while still
providing the route _definition_ aspects up front (`path`, `index`, etc.).
This is a good middle ground. React Router still knows about your route
definitions (the lightweight part) up front and can perform synchronous
route matching, but then delay loading any of the route implementation
aspects (the heavier part) until the route is actually navigated to.
In some cases, even this doesn't go far enough. For huge applications,
providing all route definitions up front can be prohibitively expensive.
Additionally, it might not even be possible to provide all route definitions
up front in certain Micro-Frontend or Module-Federation architectures.
This is where `patchRoutesOnNavigation` comes in ([RFC](https://github.com/remix-run/react-router/discussions/11113)).
This API is for advanced use-cases where you are unable to provide the full
route tree up-front and need a way to lazily "discover" portions of the route
tree at runtime. This feature is often referred to as ["Fog of War"](https://en.wikipedia.org/wiki/Fog_of_war),
because similar to how video games expand the "world" as you move around -
the router would be expanding its routing tree as the user navigated around
the app - but would only ever end up loading portions of the tree that the
user visited.
`patchRoutesOnNavigation` will be called anytime React Router is unable to
match a `path`. The arguments include the `path`, any partial `matches`,
and a `patch` function you can call to patch new routes into the tree at a
specific location. This method is executed during the `loading` portion of
the navigation for `GET` requests and during the `submitting` portion of
the navigation for non-`GET` requests.
<details>
  <summary><b>Example <code>patchRoutesOnNavigation</code> Use Cases</b></summary>
  **Patching children into an existing route**
  ```tsx
  const router = createBrowserRouter(
    [
      {
        id: "root",
        path: "/",
        Component: RootComponent,
      },
    ],
    {
      async patchRoutesOnNavigation({ patch, path }) {
        if (path === "/a") {
          // Load/patch the `a` route as a child of the route with id `root`
          let route = await getARoute();
          //  ^ { path: 'a', Component: A }
          patch("root", [route]);
        }
      },
    }
  );
  ```
  In the above example, if the user clicks a link to `/a`, React Router
  won't match any routes initially and will call `patchRoutesOnNavigation`
  with a `path = "/a"` and a `matches` array containing the root route
  match. By calling `patch('root', [route])`, the new route will be added
  to the route tree as a child of the `root` route and React Router will
  perform matching on the updated routes. This time it will successfully
  match the `/a` path and the navigation will complete successfully.
  **Patching new root-level routes**
  If you need to patch a new route to the top of the tree (i.e., it doesn't
  have a parent), you can pass `null` as the `routeId`:
  ```tsx
  const router = createBrowserRouter(
    [
      {
        id: "root",
        path: "/",
        Component: RootComponent,
      },
    ],
    {
      async patchRoutesOnNavigation({ patch, path }) {
        if (path === "/root-sibling") {
          // Load/patch the `/root-sibling` route as a sibling of the root route
          let route = await getRootSiblingRoute();
          //  ^ { path: '/root-sibling', Component: RootSibling }
          patch(null, [route]);
        }
      },
    }
  );
  ```
  **Patching subtrees asynchronously**
  You can also perform asynchronous matching to lazily fetch entire sections
  of your application:
  ```tsx
  let router = createBrowserRouter(
    [
      {
        path: "/",
        Component: Home,
      },
    ],
    {
      async patchRoutesOnNavigation({ patch, path }) {
        if (path.startsWith("/dashboard")) {
          let children = await import("./dashboard");
          patch(null, children);
        }
        if (path.startsWith("/account")) {
          let children = await import("./account");
          patch(null, children);
        }
      },
    }
  );
  ```
  <docs-info>If in-progress execution of `patchRoutesOnNavigation` is
  interrupted by a later navigation, then any remaining `patch` calls in
  the interrupted execution will not update the route tree because the
  operation was cancelled.</docs-info>
  **Co-locating route discovery with route definition**
  If you don't wish to perform your own pseudo-matching, you can leverage
  the partial `matches` array and the [`handle`](../../start/data/route-object#handle)
  field on a route to keep the children definitions co-located:
  ```tsx
  let router = createBrowserRouter(
    [
      {
        path: "/",
        Component: Home,
      },
      {
        path: "/dashboard",
        children: [
          {
            // If we want to include /dashboard in the critical routes, we need to
            // also include it's index route since patchRoutesOnNavigation will not be
            // called on a navigation to `/dashboard` because it will have successfully
            // matched the `/dashboard` parent route
            index: true,
            // ...
          },
        ],
        handle: {
          lazyChildren: () => import("./dashboard"),
        },
      },
      {
        path: "/account",
        children: [
          {
            index: true,
            // ...
          },
        ],
        handle: {
          lazyChildren: () => import("./account"),
        },
      },
    ],
    {
      async patchRoutesOnNavigation({ matches, patch }) {
        let leafRoute = matches[matches.length - 1]?.route;
        if (leafRoute?.handle?.lazyChildren) {
          let children =
            await leafRoute.handle.lazyChildren();
          patch(leafRoute.id, children);
        }
      },
    }
  );
  ```
  **A note on routes with parameters**
  Because React Router uses ranked routes to find the best match for a
  given path, there is an interesting ambiguity introduced when only a
  partial route tree is known at any given point in time. If we match a
  fully static route such as `path: "/about/contact-us"` then we know we've
  found the right match since it's composed entirely of static URL segments.
  Thus, we do not need to bother asking for any other potentially
  higher-scoring routes.
  However, routes with parameters (dynamic or splat) can't make this
  assumption because there might be a not-yet-discovered route that scores
  higher. Consider a full route tree such as:
  ```tsx
  // Assume this is the full route tree for your app
  const routes = [
    {
      path: "/",
      Component: Home,
    },
    {
      id: "blog",
      path: "/blog",
      Component: BlogLayout,
      children: [
        { path: "new", Component: NewPost },
        { path: ":slug", Component: BlogPost },
      ],
    },
  ];
  ```
  And then assume we want to use `patchRoutesOnNavigation` to fill this in
  as the user navigates around:
  ```tsx
  // Start with only the index route
  const router = createBrowserRouter(
    [
      {
        path: "/",
        Component: Home,
      },
    ],
    {
      async patchRoutesOnNavigation({ patch, path }) {
        if (path === "/blog/new") {
          patch("blog", [
            {
              path: "new",
              Component: NewPost,
            },
          ]);
        } else if (path.startsWith("/blog")) {
          patch("blog", [
            {
              path: ":slug",
              Component: BlogPost,
            },
          ]);
        }
      },
    }
  );
  ```
  If the user were to a blog post first (i.e., `/blog/my-post`) we would
  patch in the `:slug` route. Then, if the user navigated to `/blog/new` to
  write a new post, we'd match `/blog/:slug` but it wouldn't be the _right_
  match! We need to call `patchRoutesOnNavigation` just in case there
  exists a higher-scoring route we've not yet discovered, which in this
  case there is.
  So, anytime React Router matches a path that contains at least one param,
  it will call `patchRoutesOnNavigation` and match routes again just to
  confirm it has found the best match.
  If your `patchRoutesOnNavigation` implementation is expensive or making
  side effect [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/fetch)
  calls to a backend server, you may want to consider tracking previously
  seen routes to avoid over-fetching in cases where you know the proper
  route has already been found. This can usually be as simple as
  maintaining a small cache of prior `path` values for which you've already
  patched in the right routes:
  ```tsx
  let discoveredRoutes = new Set();
  const router = createBrowserRouter(routes, {
    async patchRoutesOnNavigation({ patch, path }) {
      if (discoveredRoutes.has(path)) {
        // We've seen this before so nothing to patch in and we can let the router
        // use the routes it already knows about
        return;
      }
      discoveredRoutes.add(path);
      // ... patch routes in accordingly
    },
  });
  ```
</details>
### opts.window
[`Window`](https://developer.mozilla.org/en-US/docs/Web/API/Window) object
override. Defaults to the global `window` instance.
## Returns
An initialized [data router](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html) to pass to [`<RouterProvider>`](../data-routers/RouterProvider)

---

## Page 18 — `docs/api/data-routers/createHashRouter.md`

Live URL: https://reactrouter.com/api/data-routers/createHashRouter

# createHashRouter
[MODES: data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createHashRouter.html)
Create a new [data router](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html) that manages the application
path via the URL [`hash`](https://developer.mozilla.org/en-US/docs/Web/API/URL/hash).
## Signature
```tsx
function createHashRouter(
  routes: RouteObject[],
  opts?: DOMRouterOpts,
): DataRouter
```
## Params
### routes
Application routes
### opts.basename
Basename path for the application.
### opts.future
Future flags to enable for the router.
### opts.getContext
A function that returns an [`RouterContextProvider`](../utils/RouterContextProvider) instance
which is provided as the `context` argument to client [`action`](../../start/data/route-object#action)s,
[`loader`](../../start/data/route-object#loader)s and [middleware](../../how-to/middleware).
This function is called to generate a fresh `context` instance on each
navigation or fetcher call.
```tsx
const apiClientContext = createContext<APIClient>();
function createBrowserRouter(routes, {
  getContext() {
    let context = new RouterContextProvider();
    context.set(apiClientContext, getApiClient());
    return context;
  }
})
```
### opts.hydrationData
When Server-Rendering and opting-out of automatic hydration, the
`hydrationData` option allows you to pass in hydration data from your
server-render. This will almost always be a subset of data from the
[`StaticHandlerContext`](https://api.reactrouter.com/v7/interfaces/react-router.StaticHandlerContext.html) value you get back from the [`StaticHandler`](https://api.reactrouter.com/v7/interfaces/react-router.StaticHandler.html)'s
`query` method:
```tsx
const router = createBrowserRouter(routes, {
  hydrationData: {
    loaderData: {
      // [routeId]: serverLoaderData
    },
    // may also include `errors` and/or `actionData`
  },
});
```
**Partial Hydration Data**
You will almost always include a complete set of `loaderData` to hydrate a
server-rendered app. But in advanced use-cases (such as Framework Mode's
[`clientLoader`](../../start/framework/route-module#clientLoader)), you may
want to include `loaderData` for only some routes that were loaded/rendered
on the server. This allows you to hydrate _some_ of the routes (such as the
app layout/shell) while showing a `HydrateFallback` component and running
the [`loader`](../../start/data/route-object#loader)s for other routes
during hydration.
A route [`loader`](../../start/data/route-object#loader) will run during
hydration in two scenarios:
 1. No hydration data is provided
    In these cases the `HydrateFallback` component will render on initial
    hydration
 2. The `loader.hydrate` property is set to `true`
    This allows you to run the [`loader`](../../start/data/route-object#loader)
    even if you did not render a fallback on initial hydration (i.e., to
    prime a cache with hydration data)
```tsx
const router = createBrowserRouter(
  [
    {
      id: "root",
      loader: rootLoader,
      Component: Root,
      children: [
        {
          id: "index",
          loader: indexLoader,
          HydrateFallback: IndexSkeleton,
          Component: Index,
        },
      ],
    },
  ],
  {
    hydrationData: {
      loaderData: {
        root: "ROOT DATA",
        // No index data provided
      },
    },
  }
);
```
### opts.instrumentations
Array of instrumentation objects allowing you to instrument the router and
individual routes prior to router initialization (and on any subsequently
added routes via `route.lazy` or `patchRoutesOnNavigation`).  This is
mostly useful for observability such as wrapping navigations, fetches,
as well as route loaders/actions/middlewares with logging and/or performance
tracing.  See the [docs](../../how-to/instrumentation) for more information.
```tsx
let router = createBrowserRouter(routes, {
  instrumentations: [logging]
});
let logging = {
  router({ instrument }) {
    instrument({
      navigate: (impl, info) => logExecution(`navigate ${info.to}`, impl),
      fetch: (impl, info) => logExecution(`fetch ${info.to}`, impl)
    });
  },
  route({ instrument, id }) {
    instrument({
      middleware: (impl, info) => logExecution(
        `middleware ${info.request.url} (route ${id})`,
        impl
      ),
      loader: (impl, info) => logExecution(
        `loader ${info.request.url} (route ${id})`,
        impl
      ),
      action: (impl, info) => logExecution(
        `action ${info.request.url} (route ${id})`,
        impl
      ),
    })
  }
};
async function logExecution(label: string, impl: () => Promise<void>) {
  let start = performance.now();
  console.log(`start ${label}`);
  await impl();
  let duration = Math.round(performance.now() - start);
  console.log(`end ${label} (${duration}ms)`);
}
```
### opts.dataStrategy
Override the default data strategy of running loaders in parallel -
see the [docs](../../how-to/data-strategy) for more information.
```tsx
let router = createBrowserRouter(routes, {
  async dataStrategy({
    matches,
    request,
    runClientMiddleware,
  }) {
    const matchesToLoad = matches.filter((m) =>
      m.shouldCallHandler(),
    );
    const results: Record<string, DataStrategyResult> = {};
    await runClientMiddleware(() =>
      Promise.all(
        matchesToLoad.map(async (match) => {
          results[match.route.id] = await match.resolve();
        }),
      ),
    );
    return results;
  },
});
```
### opts.patchRoutesOnNavigation
Lazily define portions of the route tree on navigations.
See [`PatchRoutesOnNavigationFunction`](https://api.reactrouter.com/v7/types/react-router.PatchRoutesOnNavigationFunction.html).
By default, React Router wants you to provide a full route tree up front via
`createBrowserRouter(routes)`. This allows React Router to perform synchronous
route matching, execute loaders, and then render route components in the most
optimistic manner without introducing waterfalls. The tradeoff is that your
initial JS bundle is larger by definition — which may slow down application
start-up times as your application grows.
To combat this, we introduced [`route.lazy`](../../start/data/route-object#lazy)
in [v6.9.0](https://github.com/remix-run/react-router/blob/main/CHANGELOG.md#v690)
which lets you lazily load the route _implementation_ ([`loader`](../../start/data/route-object#loader),
[`Component`](../../start/data/route-object#Component), etc.) while still
providing the route _definition_ aspects up front (`path`, `index`, etc.).
This is a good middle ground. React Router still knows about your route
definitions (the lightweight part) up front and can perform synchronous
route matching, but then delay loading any of the route implementation
aspects (the heavier part) until the route is actually navigated to.
In some cases, even this doesn't go far enough. For huge applications,
providing all route definitions up front can be prohibitively expensive.
Additionally, it might not even be possible to provide all route definitions
up front in certain Micro-Frontend or Module-Federation architectures.
This is where `patchRoutesOnNavigation` comes in ([RFC](https://github.com/remix-run/react-router/discussions/11113)).
This API is for advanced use-cases where you are unable to provide the full
route tree up-front and need a way to lazily "discover" portions of the route
tree at runtime. This feature is often referred to as ["Fog of War"](https://en.wikipedia.org/wiki/Fog_of_war),
because similar to how video games expand the "world" as you move around -
the router would be expanding its routing tree as the user navigated around
the app - but would only ever end up loading portions of the tree that the
user visited.
`patchRoutesOnNavigation` will be called anytime React Router is unable to
match a `path`. The arguments include the `path`, any partial `matches`,
and a `patch` function you can call to patch new routes into the tree at a
specific location. This method is executed during the `loading` portion of
the navigation for `GET` requests and during the `submitting` portion of
the navigation for non-`GET` requests.
<details>
  <summary><b>Example <code>patchRoutesOnNavigation</code> Use Cases</b></summary>
  **Patching children into an existing route**
  ```tsx
  const router = createBrowserRouter(
    [
      {
        id: "root",
        path: "/",
        Component: RootComponent,
      },
    ],
    {
      async patchRoutesOnNavigation({ patch, path }) {
        if (path === "/a") {
          // Load/patch the `a` route as a child of the route with id `root`
          let route = await getARoute();
          //  ^ { path: 'a', Component: A }
          patch("root", [route]);
        }
      },
    }
  );
  ```
  In the above example, if the user clicks a link to `/a`, React Router
  won't match any routes initially and will call `patchRoutesOnNavigation`
  with a `path = "/a"` and a `matches` array containing the root route
  match. By calling `patch('root', [route])`, the new route will be added
  to the route tree as a child of the `root` route and React Router will
  perform matching on the updated routes. This time it will successfully
  match the `/a` path and the navigation will complete successfully.
  **Patching new root-level routes**
  If you need to patch a new route to the top of the tree (i.e., it doesn't
  have a parent), you can pass `null` as the `routeId`:
  ```tsx
  const router = createBrowserRouter(
    [
      {
        id: "root",
        path: "/",
        Component: RootComponent,
      },
    ],
    {
      async patchRoutesOnNavigation({ patch, path }) {
        if (path === "/root-sibling") {
          // Load/patch the `/root-sibling` route as a sibling of the root route
          let route = await getRootSiblingRoute();
          //  ^ { path: '/root-sibling', Component: RootSibling }
          patch(null, [route]);
        }
      },
    }
  );
  ```
  **Patching subtrees asynchronously**
  You can also perform asynchronous matching to lazily fetch entire sections
  of your application:
  ```tsx
  let router = createBrowserRouter(
    [
      {
        path: "/",
        Component: Home,
      },
    ],
    {
      async patchRoutesOnNavigation({ patch, path }) {
        if (path.startsWith("/dashboard")) {
          let children = await import("./dashboard");
          patch(null, children);
        }
        if (path.startsWith("/account")) {
          let children = await import("./account");
          patch(null, children);
        }
      },
    }
  );
  ```
  <docs-info>If in-progress execution of `patchRoutesOnNavigation` is
  interrupted by a later navigation, then any remaining `patch` calls in
  the interrupted execution will not update the route tree because the
  operation was cancelled.</docs-info>
  **Co-locating route discovery with route definition**
  If you don't wish to perform your own pseudo-matching, you can leverage
  the partial `matches` array and the [`handle`](../../start/data/route-object#handle)
  field on a route to keep the children definitions co-located:
  ```tsx
  let router = createBrowserRouter(
    [
      {
        path: "/",
        Component: Home,
      },
      {
        path: "/dashboard",
        children: [
          {
            // If we want to include /dashboard in the critical routes, we need to
            // also include it's index route since patchRoutesOnNavigation will not be
            // called on a navigation to `/dashboard` because it will have successfully
            // matched the `/dashboard` parent route
            index: true,
            // ...
          },
        ],
        handle: {
          lazyChildren: () => import("./dashboard"),
        },
      },
      {
        path: "/account",
        children: [
          {
            index: true,
            // ...
          },
        ],
        handle: {
          lazyChildren: () => import("./account"),
        },
      },
    ],
    {
      async patchRoutesOnNavigation({ matches, patch }) {
        let leafRoute = matches[matches.length - 1]?.route;
        if (leafRoute?.handle?.lazyChildren) {
          let children =
            await leafRoute.handle.lazyChildren();
          patch(leafRoute.id, children);
        }
      },
    }
  );
  ```
  **A note on routes with parameters**
  Because React Router uses ranked routes to find the best match for a
  given path, there is an interesting ambiguity introduced when only a
  partial route tree is known at any given point in time. If we match a
  fully static route such as `path: "/about/contact-us"` then we know we've
  found the right match since it's composed entirely of static URL segments.
  Thus, we do not need to bother asking for any other potentially
  higher-scoring routes.
  However, routes with parameters (dynamic or splat) can't make this
  assumption because there might be a not-yet-discovered route that scores
  higher. Consider a full route tree such as:
  ```tsx
  // Assume this is the full route tree for your app
  const routes = [
    {
      path: "/",
      Component: Home,
    },
    {
      id: "blog",
      path: "/blog",
      Component: BlogLayout,
      children: [
        { path: "new", Component: NewPost },
        { path: ":slug", Component: BlogPost },
      ],
    },
  ];
  ```
  And then assume we want to use `patchRoutesOnNavigation` to fill this in
  as the user navigates around:
  ```tsx
  // Start with only the index route
  const router = createBrowserRouter(
    [
      {
        path: "/",
        Component: Home,
      },
    ],
    {
      async patchRoutesOnNavigation({ patch, path }) {
        if (path === "/blog/new") {
          patch("blog", [
            {
              path: "new",
              Component: NewPost,
            },
          ]);
        } else if (path.startsWith("/blog")) {
          patch("blog", [
            {
              path: ":slug",
              Component: BlogPost,
            },
          ]);
        }
      },
    }
  );
  ```
  If the user were to a blog post first (i.e., `/blog/my-post`) we would
  patch in the `:slug` route. Then, if the user navigated to `/blog/new` to
  write a new post, we'd match `/blog/:slug` but it wouldn't be the _right_
  match! We need to call `patchRoutesOnNavigation` just in case there
  exists a higher-scoring route we've not yet discovered, which in this
  case there is.
  So, anytime React Router matches a path that contains at least one param,
  it will call `patchRoutesOnNavigation` and match routes again just to
  confirm it has found the best match.
  If your `patchRoutesOnNavigation` implementation is expensive or making
  side effect [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/fetch)
  calls to a backend server, you may want to consider tracking previously
  seen routes to avoid over-fetching in cases where you know the proper
  route has already been found. This can usually be as simple as
  maintaining a small cache of prior `path` values for which you've already
  patched in the right routes:
  ```tsx
  let discoveredRoutes = new Set();
  const router = createBrowserRouter(routes, {
    async patchRoutesOnNavigation({ patch, path }) {
      if (discoveredRoutes.has(path)) {
        // We've seen this before so nothing to patch in and we can let the router
        // use the routes it already knows about
        return;
      }
      discoveredRoutes.add(path);
      // ... patch routes in accordingly
    },
  });
  ```
</details>
### opts.window
[`Window`](https://developer.mozilla.org/en-US/docs/Web/API/Window) object
override. Defaults to the global `window` instance.
## Returns
An initialized [data router](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html) to pass to [`<RouterProvider>`](../data-routers/RouterProvider)

---

## Page 19 — `docs/api/data-routers/createMemoryRouter.md`

Live URL: https://reactrouter.com/api/data-routers/createMemoryRouter

# createMemoryRouter
[MODES: data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createMemoryRouter.html)
Create a new [`DataRouter`](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html) that manages the application path using an
in-memory [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
stack. Useful for non-browser environments without a DOM API.
## Signature
```tsx
function createMemoryRouter(
  routes: RouteObject[],
  opts?: MemoryRouterOpts,
): DataRouter
```
## Params
### routes
Application routes
### opts.basename
Basename path for the application.
### opts.dataStrategy
Override the default data strategy of running loaders in parallel -
see the [docs](../../how-to/data-strategy) for more information.
```tsx
let router = createBrowserRouter(routes, {
  async dataStrategy({
    matches,
    request,
    runClientMiddleware,
  }) {
    const matchesToLoad = matches.filter((m) =>
      m.shouldCallHandler(),
    );
    const results: Record<string, DataStrategyResult> = {};
    await runClientMiddleware(() =>
      Promise.all(
        matchesToLoad.map(async (match) => {
          results[match.route.id] = await match.resolve();
        }),
      ),
    );
    return results;
  },
});
```
### opts.future
Future flags to enable for the router.
### opts.getContext
A function that returns an [`RouterContextProvider`](../utils/RouterContextProvider) instance
which is provided as the `context` argument to client [`action`](../../start/data/route-object#action)s,
[`loader`](../../start/data/route-object#loader)s and [middleware](../../how-to/middleware).
This function is called to generate a fresh `context` instance on each
navigation or fetcher call.
### opts.hydrationData
Hydration data to initialize the router with if you have already performed
data loading on the server.
### opts.initialEntries
Initial entries in the in-memory history stack
### opts.initialIndex
Index of `initialEntries` the application should initialize to
### opts.instrumentations
Array of instrumentation objects allowing you to instrument the router and
individual routes prior to router initialization (and on any subsequently
added routes via `route.lazy` or `patchRoutesOnNavigation`).  This is
mostly useful for observability such as wrapping navigations, fetches,
as well as route loaders/actions/middlewares with logging and/or performance
tracing.  See the [docs](../../how-to/instrumentation) for more information.
```tsx
let router = createBrowserRouter(routes, {
  instrumentations: [logging]
});
let logging = {
  router({ instrument }) {
    instrument({
      navigate: (impl, info) => logExecution(`navigate ${info.to}`, impl),
      fetch: (impl, info) => logExecution(`fetch ${info.to}`, impl)
    });
  },
  route({ instrument, id }) {
    instrument({
      middleware: (impl, info) => logExecution(
        `middleware ${info.request.url} (route ${id})`,
        impl
      ),
      loader: (impl, info) => logExecution(
        `loader ${info.request.url} (route ${id})`,
        impl
      ),
      action: (impl, info) => logExecution(
        `action ${info.request.url} (route ${id})`,
        impl
      ),
    })
  }
};
async function logExecution(label: string, impl: () => Promise<void>) {
  let start = performance.now();
  console.log(`start ${label}`);
  await impl();
  let duration = Math.round(performance.now() - start);
  console.log(`end ${label} (${duration}ms)`);
}
```
### opts.patchRoutesOnNavigation
Lazily define portions of the route tree on navigations.
## Returns
An initialized [`DataRouter`](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html) to pass to [`<RouterProvider>`](../data-routers/RouterProvider)

---

## Page 20 — `docs/api/data-routers/createStaticHandler.md`

Live URL: https://reactrouter.com/api/data-routers/createStaticHandler

# createStaticHandler
[MODES: data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createStaticHandler.html)
Create a static handler to perform server-side data loading
```tsx
export async function handleRequest(request: Request) {
  let { query, dataRoutes } = createStaticHandler(routes);
  let context = await query(request);
  if (context instanceof Response) {
    return context;
  }
  let router = createStaticRouter(dataRoutes, context);
  return new Response(
    ReactDOMServer.renderToString(<StaticRouterProvider ... />),
    { headers: { "Content-Type": "text/html" } }
  );
}
```
## Signature
```tsx
function createStaticHandler(
  routes: RouteObject[],
  opts?: CreateStaticHandlerOptions,
)
```
## Params
### routes
The [route objects](https://api.reactrouter.com/v7/types/react-router.RouteObject.html) to create a static handler for
### opts.basename
The base URL for the static handler (default: `/`)
### opts.future
Future flags for the static handler
## Returns
A static handler that can be used to query data for the provided
routes

---

## Page 21 — `docs/api/data-routers/createStaticRouter.md`

Live URL: https://reactrouter.com/api/data-routers/createStaticRouter

# createStaticRouter
[MODES: data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createStaticRouter.html)
Create a static [`DataRouter`](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html) for server-side rendering
```tsx
export async function handleRequest(request: Request) {
  let { query, dataRoutes } = createStaticHandler(routes);
  let context = await query(request);
  if (context instanceof Response) {
    return context;
  }
  let router = createStaticRouter(dataRoutes, context);
  return new Response(
    ReactDOMServer.renderToString(<StaticRouterProvider ... />),
    { headers: { "Content-Type": "text/html" } }
  );
}
```
## Signature
```tsx
function createStaticRouter(
  routes: RouteObject[],
  context: StaticHandlerContext,
  opts: {
    branches?: RouteBranch<DataRouteObject>[];
    future?: Partial<FutureConfig>;
  } = ,
): DataRouter {}
```
## Params
### routes
The route objects to create a static [`DataRouter`](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html) for
### context
The [`StaticHandlerContext`](https://api.reactrouter.com/v7/interfaces/react-router.StaticHandlerContext.html) returned from [`StaticHandler`](https://api.reactrouter.com/v7/interfaces/react-router.StaticHandler.html)'s `query`
### opts.future
Future flags for the static [`DataRouter`](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html)
### opts.branches
Optional pre-computed route branches
## Returns
A static [`DataRouter`](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html) that can be used to render the provided routes

---

## Page 22 — `docs/api/data-routers/index.md`

Live URL: https://reactrouter.com/api/data-routers/index



---

## Page 23 — `docs/api/declarative-routers/BrowserRouter.md`

Live URL: https://reactrouter.com/api/declarative-routers/BrowserRouter

# BrowserRouter
[MODES: declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.BrowserRouter.html)
A declarative [`<Router>`](../declarative-routers/Router) using the browser [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
API for client-side routing.
## Signature
```tsx
function BrowserRouter({
  basename,
  children,
  useTransitions,
  window,
}: BrowserRouterProps)
```
## Props
### basename
Application basename
### children
``<Route>`` components describing your route configuration
### useTransitions
Control whether router state updates are internally wrapped in
[`React.startTransition`](https://react.dev/reference/react/startTransition).
- When left `undefined`, all router state updates are wrapped in
  `React.startTransition`
- When set to `true`, [`Link`](../components/Link) and [`Form`](../components/Form) navigations will be wrapped
  in `React.startTransition` and all router state updates are wrapped in
  `React.startTransition`
- When set to `false`, the router will not leverage `React.startTransition`
  on any navigations or state changes.
For more information, please see the [docs](../../explanation/react-transitions).
### window
[`Window`](https://developer.mozilla.org/en-US/docs/Web/API/Window) object
override. Defaults to the global `window` instance

---

## Page 24 — `docs/api/declarative-routers/HashRouter.md`

Live URL: https://reactrouter.com/api/declarative-routers/HashRouter

# HashRouter
[MODES: declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.HashRouter.html)
A declarative [`<Router>`](../declarative-routers/Router) that stores the location in the
[`hash`](https://developer.mozilla.org/en-US/docs/Web/API/URL/hash) portion
of the URL so it is not sent to the server.
## Signature
```tsx
function HashRouter({
  basename,
  children,
  useTransitions,
  window,
}: HashRouterProps)
```
## Props
### basename
Application basename
### children
``<Route>`` components describing your route configuration
### useTransitions
Control whether router state updates are internally wrapped in
[`React.startTransition`](https://react.dev/reference/react/startTransition).
- When left `undefined`, all router state updates are wrapped in
  `React.startTransition`
- When set to `true`, [`Link`](../components/Link) and [`Form`](../components/Form) navigations will be wrapped
  in `React.startTransition` and all router state updates are wrapped in
  `React.startTransition`
- When set to `false`, the router will not leverage `React.startTransition`
  on any navigations or state changes.
For more information, please see the [docs](../../explanation/react-transitions).
### window
[`Window`](https://developer.mozilla.org/en-US/docs/Web/API/Window) object
override. Defaults to the global `window` instance

---

## Page 25 — `docs/api/declarative-routers/HistoryRouter.md`

Live URL: https://reactrouter.com/api/declarative-routers/HistoryRouter

# unstable_HistoryRouter
[MODES: declarative]
<br />
<br />
<docs-warning>This API is experimental and subject to breaking changes in 
minor/patch releases. Please use with caution and pay **very** close attention 
to release notes for relevant changes.</docs-warning>
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.unstable_HistoryRouter.html)
A declarative [`<Router>`](../declarative-routers/Router) that accepts a pre-instantiated
`history` object.
It's important to note that using your own `history` object is highly discouraged
and may add two versions of the `history` library to your bundles unless you use
the same version of the `history` library that React Router uses internally.
## Signature
```tsx
function HistoryRouter({
  basename,
  children,
  history,
  useTransitions,
}: HistoryRouterProps)
```
## Props
### basename
Application basename
### children
``<Route>`` components describing your route configuration
### history
A `History` implementation for use by the router
### useTransitions
Control whether router state updates are internally wrapped in
[`React.startTransition`](https://react.dev/reference/react/startTransition).
- When left `undefined`, all router state updates are wrapped in
  `React.startTransition`
- When set to `true`, [`Link`](../components/Link) and [`Form`](../components/Form) navigations will be wrapped
  in `React.startTransition` and all router state updates are wrapped in
  `React.startTransition`
- When set to `false`, the router will not leverage `React.startTransition`
  on any navigations or state changes.
For more information, please see the [docs](../../explanation/react-transitions).

---

## Page 26 — `docs/api/declarative-routers/MemoryRouter.md`

Live URL: https://reactrouter.com/api/declarative-routers/MemoryRouter

# MemoryRouter
[MODES: declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.MemoryRouter.html)
A declarative [`<Router>`](../declarative-routers/Router) that stores all entries in memory.
## Signature
```tsx
function MemoryRouter({
  basename,
  children,
  initialEntries,
  initialIndex,
  useTransitions,
}: MemoryRouterProps): React.ReactElement
```
## Props
### basename
Application basename
### children
Nested [`Route`](../components/Route) elements describing the route tree
### initialEntries
Initial entries in the in-memory history stack
### initialIndex
Index of `initialEntries` the application should initialize to
### useTransitions
Control whether router state updates are internally wrapped in
[`React.startTransition`](https://react.dev/reference/react/startTransition).
- When left `undefined`, all router state updates are wrapped in
  `React.startTransition`
- When set to `true`, [`Link`](../components/Link) and [`Form`](../components/Form) navigations will be wrapped
  in `React.startTransition` and all router state updates are wrapped in
  `React.startTransition`
- When set to `false`, the router will not leverage `React.startTransition`
  on any navigations or state changes.
For more information, please see the [docs](../../explanation/react-transitions).

---

## Page 27 — `docs/api/declarative-routers/Router.md`

Live URL: https://reactrouter.com/api/declarative-routers/Router

# Router
[MODES: declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.Router.html)
Provides location context for the rest of the app.
Note: You usually won't render a `<Router>` directly. Instead, you'll render a
router that is more specific to your environment such as a [`BrowserRouter`](../declarative-routers/BrowserRouter)
in web browsers or a [`ServerRouter`](../framework-routers/ServerRouter) for server rendering.
## Signature
```tsx
function Router({
  basename: basenameProp = "/",
  children = null,
  location: locationProp,
  navigationType = NavigationType.Pop,
  navigator,
  static: staticProp = false,
  useTransitions,
}: RouterProps): React.ReactElement | null
```
## Props
### basename
The base path for the application. This is prepended to all locations
### children
Nested [`Route`](../components/Route) elements describing the route tree
### location
The location to match against. Defaults to the current location.
This can be a string or a [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html) object.
### navigationType
The type of navigation that triggered this `location` change.
Defaults to `NavigationType.Pop`.
### navigator
The navigator to use for navigation. This is usually a history object
or a custom navigator that implements the [`Navigator`](https://api.reactrouter.com/v7/interfaces/react-router.Navigator.html) interface.
### static
Whether this router is static or not (used for SSR). If `true`, the router
will not be reactive to location changes.
### useTransitions
Control whether router state updates are internally wrapped in
[`React.startTransition`](https://react.dev/reference/react/startTransition).
- When left `undefined`, all router state updates are wrapped in
  `React.startTransition`
- When set to `true`, [`Link`](../components/Link) and [`Form`](../components/Form) navigations will be wrapped
  in `React.startTransition` and all router state updates are wrapped in
  `React.startTransition`
- When set to `false`, the router will not leverage `React.startTransition`
  on any navigations or state changes.
For more information, please see the [docs](../../explanation/react-transitions).

---

## Page 28 — `docs/api/declarative-routers/StaticRouter.md`

Live URL: https://reactrouter.com/api/declarative-routers/StaticRouter

# StaticRouter
[MODES: declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.StaticRouter.html)
A [`<Router>`](../declarative-routers/Router) that may not navigate to any other [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html).
This is useful on the server where there is no stateful UI.
## Signature
```tsx
function StaticRouter({
  basename,
  children,
  location: locationProp = "/",
}: StaticRouterProps)
```
## Props
### basename
The base URL for the static router (default: `/`)
### children
The child elements to render inside the static router
### location
The [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html) to render the static router at (default: `/`)

---

## Page 29 — `docs/api/declarative-routers/index.md`

Live URL: https://reactrouter.com/api/declarative-routers/index



---

## Page 30 — `docs/api/framework-conventions/client-modules.md`

Live URL: https://reactrouter.com/api/framework-conventions/client-modules

# `.client` modules
[MODES: framework]
## Summary
You may have a file or dependency that uses module side effects in the browser. You can use `*.client.ts` on file names or nest files within `.client` directories to force them out of server bundles.
```ts filename=feature-check.client.ts
// this would break the server
```
Note that values exported from this module will all be `undefined` on the server, so the only places to use them are in [`useEffect`][use_effect] and user events like click handlers.
```ts
console.log(supportsVibrationAPI);
// server: undefined
// client: true | false
```
<docs-info>
If you need more sophisticated control over what is included in the client/server bundles, check out the [`vite-env-only` plugin](https://github.com/pcattori/vite-env-only).
</docs-info>
## Usage Patterns
### Individual Files
Mark individual files as client-only by adding `.client` to the filename:
```txt
app/
├── utils.client.ts        👈 client-only file
├── feature-detection.client.ts
└── root.tsx
```
### Client Directories
Mark entire directories as client-only by using `.client` in the directory name:
```txt
app/
├── .client/               👈 entire directory is client-only
│   ├── analytics.ts
│   ├── feature-detection.ts
│   └── browser-utils.ts
├── components/
└── root.tsx
```
## Examples
### Browser Feature Detection
```ts filename=app/utils/browser.client.ts
```
### Client-Only Libraries
```ts filename=app/analytics.client.ts
// This would break on the server
export function trackEvent(eventName: string, data: any) {
  track(eventName, data);
}
```
### Using Client Modules
```tsx filename=app/routes/dashboard.tsx
export default function Dashboard() {
  useEffect(() => {
    // These values are undefined on the server
    if (canUseDOM && supportsVibrationAPI) {
      console.log("Device supports vibration");
    }
    // Safe localStorage usage
    const savedTheme =
      supportsLocalStorage.getItem("theme");
    if (savedTheme) {
      document.body.className = savedTheme;
    }
    trackEvent("dashboard_viewed", {
      timestamp: Date.now(),
    });
  }, []);
  return <div>Dashboard</div>;
}
```
[use_effect]: https://react.dev/reference/react/useEffect

---

## Page 31 — `docs/api/framework-conventions/entry.client.tsx.md`

Live URL: https://reactrouter.com/api/framework-conventions/entry.client.tsx

# entry.client.tsx
[MODES: framework]
## Summary
<docs-info>
This file is optional
</docs-info>
This file is the entry point for the browser and is responsible for hydrating the markup generated by the server in your [server entry module][server-entry]
This is the first piece of code that runs in the browser. You can initialize any other client-side code here, such as client side libraries, add client only providers, etc.
```tsx filename=app/entry.client.tsx
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
```
## Generating `entry.client.tsx`
By default, React Router will handle hydrating your app on the client for you. You can reveal the default entry client file with the following:
```shellscript nonumber
npx react-router reveal
```
[server-entry]: ./entry.server.tsx

---

## Page 32 — `docs/api/framework-conventions/entry.server.tsx.md`

Live URL: https://reactrouter.com/api/framework-conventions/entry.server.tsx

# entry.server.tsx
[MODES: framework]
## Summary
This file is the server-side entry point that controls how your React Router application generates HTTP responses on the server.
This module should render the markup for the current page using a [`<ServerRouter>`][serverrouter] element with the `context` and `url` for the current request. This markup will (optionally) be re-hydrated once JavaScript loads in the browser using the [client entry module][client-entry].
<docs-info>This file is optional if you are running on Node. If it is not present, a [default implementation][node-streaming-entry-server] will be used.
<br/>
<br/>
If you are using another runtime (i.e., Cloudflare) then you need to include this file. You can find sample implementations in the [templates repository][templates-repo].</docs-info>
## Generating `entry.server.tsx`
When running in Node, React Router will handle generating the HTTP Response for you. You can reveal the default entry server file with the following:
```shellscript nonumber
npx react-router reveal
```
## Exports
### `default`
The `default` export of this module is a function that lets you create the response, including HTTP status, headers, and HTML, giving you full control over the way the markup is generated and sent to the client.
```tsx filename=app/entry.server.tsx
export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter
        context={routerContext}
        url={request.url}
      />,
      {
        onShellReady() {
          responseHeaders.set("Content-Type", "text/html");
          const body = new PassThrough();
          const stream =
            createReadableStreamFromReadable(body);
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
      },
    );
  });
}
```
### `streamTimeout`
If you are [streaming] responses, you can export an optional `streamTimeout` value (in milliseconds) that will control the amount of time the server will wait for streamed promises to settle before rejecting outstanding promises and closing the stream.
It's recommended to decouple this value from the timeout in which you abort the React renderer. You should always set the React rendering timeout to a higher value so it has time to stream down the underlying rejections from your `streamTimeout`.
```tsx lines=[1-2,13-15]
// Reject all pending promises from handler functions after 10 seconds
export default function handleRequest(...) {
  return new Promise((resolve, reject) => {
    // ...
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      { /* ... */ }
    );
    // Abort the streaming render pass after 11 seconds to allow the rejected
    // boundaries to be flushed
    setTimeout(abort, streamTimeout + 1000);
  });
}
```
### `handleDataRequest`
You can export an optional `handleDataRequest` function that will allow you to modify the response of a data request. These are the requests that do not render HTML, but rather return the `loader` and `action` data to the browser once client-side hydration has occurred.
```tsx
export function handleDataRequest(
  response: Response,
  {
    request,
    params,
    context,
  }: LoaderFunctionArgs | ActionFunctionArgs,
) {
  response.headers.set("X-Custom-Header", "value");
  return response;
}
```
### `handleError`
By default, React Router will log encountered server-side errors to the console. If you'd like more control over the logging, or would like to also report these errors to an external service, then you can export an optional `handleError` function which will give you control (and will disable the built-in error logging).
```tsx
export function handleError(
  error: unknown,
  {
    request,
    params,
    context,
  }: LoaderFunctionArgs | ActionFunctionArgs,
) {
  if (!request.signal.aborted) {
    sendErrorToErrorReportingService(error);
    console.error(formatErrorForJsonLogging(error));
  }
}
```
_Note that you generally want to avoid logging when the request was aborted, since React Router's cancellation and race-condition handling can cause a lot of requests to be aborted._
**Streaming Rendering Errors**
When you are streaming your HTML responses via [`renderToPipeableStream`][rendertopipeablestream] or [`renderToReadableStream`][rendertoreadablestream], your own `handleError` implementation will only handle errors encountered during the initial shell render. If you encounter a rendering error during subsequent streamed rendering you will need to handle these errors manually since the React Router server has already sent the Response by that point.
For `renderToPipeableStream`, you can handle these errors in the `onError` callback function. You will need to toggle a boolean in `onShellReady` so you know if the error was a shell rendering error (and can be ignored) or an async
For an example, please refer to the default [`entry.server.tsx`][node-streaming-entry-server] for Node.
**Thrown Responses**
Note that this does not handle thrown `Response` instances from your `loader`/`action` functions. The intention of this handler is to find bugs in your code which result in unexpected thrown errors. If you are detecting a scenario and throwing a 401/404/etc. `Response` in your `loader`/`action` then it's an expected flow that is handled by your code. If you also wish to log, or send those to an external service, that should be done at the time you throw the response.
[client-entry]: ./entry.client.tsx
[serverrouter]: ../framework-routers/ServerRouter
[streaming]: ../../how-to/suspense
[rendertopipeablestream]: https://react.dev/reference/react-dom/server/renderToPipeableStream
[rendertoreadablestream]: https://react.dev/reference/react-dom/server/renderToReadableStream
[node-streaming-entry-server]: https://github.com/remix-run/react-router/blob/dev/packages/react-router-dev/config/defaults/entry.server.node.tsx
[templates-repo]: https://github.com/remix-run/react-router-templates

---

## Page 33 — `docs/api/framework-conventions/index.md`

Live URL: https://reactrouter.com/api/framework-conventions/index



---

## Page 34 — `docs/api/framework-conventions/react-router.config.ts.md`

Live URL: https://reactrouter.com/api/framework-conventions/react-router.config.ts

# react-router.config.ts
[MODES: framework]
## Summary
<docs-info>
This file is optional
</docs-info>
[Reference Documentation ↗](https://api.reactrouter.com/v7/types/_react-router_dev.config.Config.html)
React Router framework configuration file that lets you customize aspects of your React Router application like server-side rendering, directory locations, and build settings.
```tsx filename=react-router.config.ts
export default {
  appDirectory: "app",
  buildDirectory: "build",
  ssr: true,
  prerender: ["/", "/about"],
} satisfies Config;
```
## Options
### `allowedActionOrigins`
An array of allowed origin hosts for action submissions to UI routes (does not apply to resource routes). Supports micromatch glob patterns (`*` to match one segment, `**` to match multiple).
```tsx filename=react-router.config.ts
export default {
  allowedActionOrigins: [
    "example.com",
    "*.example.com", // sub.example.com
    "**.example.com", // sub.domain.example.com
  ],
} satisfies Config;
```
If you need to set this value at runtime, you can do in by setting the value on the server build in your custom server. For example, when using `express`:
```ts
async function getBuild() {
  let build: ServerBuild = await import(
    "virtual:react-router/server-build"
  );
  return {
    ...build,
    allowedActionOrigins:
      process.env.NODE_ENV === "development"
        ? undefined
        : ["staging.example.com", "www.example.com"],
  };
}
app.use(createRequestHandler({ build: getBuild }));
```
### `appDirectory`
The path to the `app` directory, relative to the root directory. Defaults to `"app"`.
```tsx filename=react-router.config.ts
export default {
  appDirectory: "src",
} satisfies Config;
```
### `basename`
The React Router app basename. Defaults to `"/"`.
```tsx filename=react-router.config.ts
export default {
  basename: "/my-app",
} satisfies Config;
```
### `buildDirectory`
The path to the build directory, relative to the project. Defaults to `"build"`.
```tsx filename=react-router.config.ts
export default {
  buildDirectory: "dist",
} satisfies Config;
```
### `buildEnd`
A function that is called after the full React Router build is complete.
```tsx filename=react-router.config.ts
export default {
  buildEnd: async ({
    buildManifest,
    reactRouterConfig,
    viteConfig,
  }) => {
    // Custom build logic here
    console.log("Build completed!");
  },
} satisfies Config;
```
### `future`
Enabled future flags for opting into upcoming features.
See [Future Flags][future-flags] for more information.
```tsx filename=react-router.config.ts
export default {
  future: {
    // Enable future flags here
  },
} satisfies Config;
```
### `prerender`
An array of URLs to prerender to HTML files at build time - see [Pre-Rendering][pre-rendering] for more information.
```tsx filename=react-router.config.ts
export default {
  // Static array
  prerender: ["/", "/about", "/contact"],
  // Or dynamic function
  prerender: async ({ getStaticPaths }) => {
    const paths = await getStaticPaths();
    return ["/", ...paths];
  },
  // Or an object if you wish to enable concurrency
  prerender: {
    paths: ["/", "/about", "/contact"],
    concurrency: 4,
  }
} satisfies Config;
```
### `presets`
An array of React Router plugin config presets to ease integration with other platforms and tools.
See [Presets][presets] for more information.
```tsx filename=react-router.config.ts
export default {
  presets: [
    // Add presets here
  ],
} satisfies Config;
```
### `routeDiscovery`
Configure how routes are discovered and loaded by the client. Defaults to `mode: "lazy"` with `manifestPath: "/__manifest"`.
**Options:**
- `mode: "lazy"` - Routes are discovered as the user navigates (default)
  - `manifestPath` - Custom path for manifest requests when using `lazy` mode
- `mode: "initial"` - All routes are included in the initial manifest
```tsx filename=react-router.config.ts
export default {
  // Enable lazy route discovery (default)
  routeDiscovery: {
    mode: "lazy",
    manifestPath: "/__manifest",
  },
  // Use a custom manifest path
  routeDiscovery: {
    mode: "lazy",
    manifestPath: "/custom-manifest",
  },
  // Disable lazy discovery and include all routes initially
  routeDiscovery: { mode: "initial" },
} satisfies Config;
```
See [Lazy Route Discovery][lazy-route-discovery] for more information.
### `serverBuildFile`
The file name of the server build output. This file should end in a `.js` extension and should be deployed to your server. Defaults to `"index.js"`.
```tsx filename=react-router.config.ts
export default {
  serverBuildFile: "server.js",
} satisfies Config;
```
### `serverBundles`
A function for assigning routes to different server bundles. This function should return a server bundle ID which will be used as the bundle's directory name within the server build directory.
See [Server Bundles][server-bundles] for more information.
```tsx filename=react-router.config.ts
export default {
  serverBundles: ({ branch }) => {
    // Return bundle ID based on route branch
    return branch.some((route) => route.id === "admin")
      ? "admin"
      : "main";
  },
} satisfies Config;
```
### `serverModuleFormat`
The output format of the server build. Defaults to `"esm"`.
```tsx filename=react-router.config.ts
export default {
  serverModuleFormat: "cjs", // or "esm"
} satisfies Config;
```
### `ssr`
If `true`, React Router will server render your application.
If `false`, React Router will pre-render your application and save it as an `index.html` file with your assets so your application can be deployed as a SPA without server-rendering. See ["SPA Mode"][spa-mode] for more information.
Defaults to `true`.
```tsx filename=react-router.config.ts
export default {
  ssr: false, // disabled server-side rendering
} satisfies Config;
```
[future-flags]: ../../upgrading/future
[presets]: ../../how-to/presets
[server-bundles]: ../../how-to/server-bundles
[pre-rendering]: ../../how-to/pre-rendering
[spa-mode]: ../../how-to/spa
[lazy-route-discovery]: ../../explanation/lazy-route-discovery

---

## Page 35 — `docs/api/framework-conventions/root.tsx.md`

Live URL: https://reactrouter.com/api/framework-conventions/root.tsx

# root.tsx
[MODES: framework]
## Summary
<docs-info>
This file is required
</docs-info>
The "root" route (`app/root.tsx`) is the only _required_ route in your React Router application because it is the parent to all routes and is in charge of rendering the root `<html>` document.
```tsx filename=app/root.tsx
export default function App() {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
```
## Components to Render
Because the root route manages your document, it is the proper place to render a handful of "document-level" components React Router provides. These components are to be used once inside your root route and they include everything React Router figured out or built in order for your page to render properly.
```tsx filename=app/root.tsx
export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </head>
      <body>
        {/* Child routes render here */}
        <Outlet />
        {/* Manages scroll position for client-side transitions */}
        {/* If you use a nonce-based content security policy for scripts, you must provide the `nonce` prop. Otherwise, omit the nonce prop as shown here. */}
        <ScrollRestoration />
        {/* Script tags go here */}
        {/* If you use a nonce-based content security policy for scripts, you must provide the `nonce` prop. Otherwise, omit the nonce prop as shown here. */}
        <Scripts />
      </body>
    </html>
  );
}
```
If you are not on React 19 or choosing not to use React's [`<link>`][react-link], [`<title>`][react-title], and [`<meta>`][react-meta] components, and instead relying on React Router's [`links`][react-router-links] and [`meta`][react-router-meta] exports, you need to add the following to your root route:
```tsx filename=app/root.tsx
export default function App() {
  return (
    <html lang="en">
      <head>
        {/* All `meta` exports on all routes will render here */}
        <Meta />
        {/* All `link` exports on all routes will render here */}
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```
## Layout Export
The root route supports all [route module exports][route-module].
The root route also supports an additional optional `Layout` export. The `Layout` component serves 2 purposes:
1. Avoid duplicating your document's "app shell" across your root component, `HydrateFallback`, and `ErrorBoundary`
2. Prevent React from re-mounting your app shell elements when switching between the root component/`HydrateFallback`/`ErrorBoundary` which can cause a FOUC if React removes and re-adds `<link rel="stylesheet">` tags from your `<Links>` component.
`Layout` takes a single `children` prop, which is the `default` export (e.g. `App`), `HydrateFallback`, or `ErrorBoundary`.
```tsx filename=app/root.tsx
export function Layout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {/* children will be the root Component, ErrorBoundary, or HydrateFallback */}
        {children}
        <Scripts />
        <ScrollRestoration />
      </body>
    </html>
  );
}
export default function App() {
  return <Outlet />;
}
export function ErrorBoundary() {}
```
**A note on `useLoaderData`in the `Layout` Component**
`useLoaderData` is not permitted to be used in `ErrorBoundary` components because it is intended for the happy-path route rendering, and its typings have a built-in assumption that the `loader` ran successfully and returned something. That assumption doesn't hold in an `ErrorBoundary` because it could have been the `loader` that threw and triggered the boundary! In order to access loader data in `ErrorBoundary`'s, you can use `useRouteLoaderData` which accounts for the loader data potentially being `undefined`.
Because your `Layout` component is used in both success and error flows, this same restriction holds. If you need to fork logic in your `Layout` depending on if it was a successful request or not, you can use `useRouteLoaderData("root")` and `useRouteError()`.
<docs-warn>Because your `<Layout>` component is used for rendering the `ErrorBoundary`, you should be _very defensive_ to ensure that you can render your `ErrorBoundary` without encountering any render errors. If your `Layout` throws another error trying to render the boundary, then it can't be used and your UI will fall back to the very minimal built-in default `ErrorBoundary`.</docs-warn>
```tsx filename=app/root.tsx lines=[6-7,19-29,32-34]
export function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = useRouteLoaderData("root");
  const error = useRouteError();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <Meta />
        <Links />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --themeVar: ${
                  data?.themeVar || defaultThemeVar
                }
              }
            `,
          }}
        />
      </head>
      <body>
        {data ? (
          <Analytics token={data.analyticsToken} />
        ) : null}
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```
[route-module]: ../../start/framework/route-module
[react-link]: https://react.dev/reference/react-dom/components/link
[react-meta]: https://react.dev/reference/react-dom/components/meta
[react-title]: https://react.dev/reference/react-dom/components/title
[react-router-links]: ../../start/framework/route-module#links
[react-router-meta]: ../../start/framework/route-module#meta

---

## Page 36 — `docs/api/framework-conventions/routes.ts.md`

Live URL: https://reactrouter.com/api/framework-conventions/routes.ts

# routes.ts
[MODES: framework]
## Summary
<docs-info>
This file is required
</docs-info>
[Reference Documentation ↗](https://api.reactrouter.com/v7/interfaces/_react-router_dev.routes.RouteConfigEntry.html)
Configuration file that maps URL patterns to route modules in your application.
See the [routing guide][routing] for more information.
## Examples
### Basic
Configure your routes as an array of objects.
```tsx filename=app/routes.ts
export default [
  route("some/path", "./some/file.tsx"),
  // pattern ^           ^ module file
] satisfies RouteConfig;
```
You can use the following helpers to create route config entries:
- [`route`][route] — Helper function for creating a route config entry
- [`index`][index] — Helper function for creating a route config entry for an index route
- [`layout`][layout] — Helper function for creating a route config entry for a layout route
- [`prefix`][prefix] — Helper function for adding a path prefix to a set of routes without needing to introduce a parent route
- [`relative`][relative] — Creates a set of route config helpers that resolve file paths relative to the given directory. Designed to support splitting route config into multiple files within different directories
### File-based Routing
If you prefer to define your routes via file naming conventions rather than configuration, the `@react-router/fs-routes` package provides a [file system routing convention][file-route-conventions]:
```ts filename=app/routes.ts
export default flatRoutes() satisfies RouteConfig;
```
### Route Helpers
[routing]: ../../start/framework/routing
[route]: https://api.reactrouter.com/v7/functions/_react-router_dev.routes.route.html
[index]: https://api.reactrouter.com/v7/functions/_react-router_dev.routes.index.html
[layout]: https://api.reactrouter.com/v7/functions/_react-router_dev.routes.layout.html
[prefix]: https://api.reactrouter.com/v7/functions/_react-router_dev.routes.prefix.html
[relative]: https://api.reactrouter.com/v7/functions/_react-router_dev.routes.relative.html
[file-route-conventions]: ../../how-to/file-route-conventions

---

## Page 37 — `docs/api/framework-conventions/server-modules.md`

Live URL: https://reactrouter.com/api/framework-conventions/server-modules

# `.server` modules
[MODES: framework]
## Summary
Server-only modules that are excluded from client bundles and only run on the server.
```ts filename=auth.server.ts
// This would expose secrets on the client if not exported from a server-only module
export function validateToken(token: string) {
  // Server-only authentication logic
}
```
`.server` modules are a good way to explicitly mark entire modules as server-only. The build will fail if any code in a `.server` file or `.server` directory accidentally ends up in the client module graph.
<docs-warning>
Route modules should not be marked as `.server` or `.client` as they have special handling and need to be referenced in both server and client module graphs. Attempting to do so will cause build errors.
</docs-warning>
<docs-info>
If you need more sophisticated control over what is included in the client/server bundles, check out the [`vite-env-only` plugin](https://github.com/pcattori/vite-env-only).
</docs-info>
## Usage Patterns
### Individual Files
Mark individual files as server-only by adding `.server` to the filename:
```txt
app/
├── auth.server.ts         👈 server-only file
├── database.server.ts
├── email.server.ts
└── root.tsx
```
### Server Directories
Mark entire directories as server-only by using `.server` in the directory name:
```txt
app/
├── .server/               👈 entire directory is server-only
│   ├── auth.ts
│   ├── database.ts
│   └── email.ts
├── components/
└── root.tsx
```
## Examples
### Database Connection
```ts filename=app/utils/db.server.ts
// This would expose database credentials on the client
const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
export { db };
```
### Authentication Utilities
```ts filename=app/utils/auth.server.ts
const JWT_SECRET = process.env.JWT_SECRET!;
export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
export function verifyPassword(
  password: string,
  hash: string
) {
  return bcrypt.compare(password, hash);
}
export function createToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: "7d",
  });
}
export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as {
    userId: string;
  };
}
```
### Using Server Modules
```tsx filename=app/routes/login.tsx
export async function action({
  request,
}: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  // Server-only operations
  const hashedPassword = await hashPassword(password);
  const user = await db.user.create({
    data: { email, password: hashedPassword },
  });
  const token = createToken(user.id);
  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": `token=${token}; HttpOnly; Secure; SameSite=Strict`,
    },
  });
}
export default function Login() {
  return (
    <form method="post">
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit">Login</button>
    </form>
  );
}
```

---

## Page 38 — `docs/api/framework-routers/HydratedRouter.md`

Live URL: https://reactrouter.com/api/framework-routers/HydratedRouter

# HydratedRouter
[MODES: framework]
## Summary
Framework-mode router component to be used to hydrate a router from a
[`ServerRouter`](../framework-routers/ServerRouter). See [`entry.client.tsx`](../framework-conventions/entry.client.tsx).
## Signature
```tsx
function HydratedRouter(props: HydratedRouterProps)
```
## Props
### getContext
Context factory function to be passed through to [`createBrowserRouter`](../data-routers/createBrowserRouter).
This function will be called to create a fresh `context` instance on each
navigation/fetch and made available to
[`clientAction`](../../start/framework/route-module#clientAction)/[`clientLoader`](../../start/framework/route-module#clientLoader)
functions.
### onError
An error handler function that will be called for any middleware, loader, action,
or render errors that are encountered in your application.  This is useful for
logging or reporting errors instead of in the `ErrorBoundary` because it's not
subject to re-rendering and will only run one time per error.
The `errorInfo` parameter is passed along from
[`componentDidCatch`](https://react.dev/reference/react/Component#componentdidcatch)
and is only present for render errors.
```tsx
<HydratedRouter onError=(error, info) => {
  let { location, params, pattern, errorInfo } = info;
  console.error(error, location, errorInfo);
  reportToErrorService(error, location, errorInfo);
}} />
```

---

## Page 39 — `docs/api/framework-routers/ServerRouter.md`

Live URL: https://reactrouter.com/api/framework-routers/ServerRouter

# ServerRouter
[MODES: framework]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.ServerRouter.html)
The server entry point for a React Router app in Framework Mode. This
component is used to generate the HTML in the response from the server. See
[`entry.server.tsx`](../framework-conventions/entry.server.tsx).
## Signature
```tsx
function ServerRouter({
  context,
  url,
  nonce,
}: ServerRouterProps): ReactElement
```
## Props
### context
The entry context containing the manifest, route modules, and other data
needed for rendering.
### nonce
An optional `nonce` for [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
compliance, used to allow inline scripts to run safely.
### url
The URL of the request being handled.

---

## Page 40 — `docs/api/framework-routers/index.md`

Live URL: https://reactrouter.com/api/framework-routers/index



---

## Page 41 — `docs/api/hooks/index.md`

Live URL: https://reactrouter.com/api/hooks/index



---

## Page 42 — `docs/api/hooks/useActionData.md`

Live URL: https://reactrouter.com/api/hooks/useActionData

# useActionData
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useActionData.html)
Returns the [`action`](../../start/framework/route-module#action) data from
the most recent `POST` navigation form submission or `undefined` if there
hasn't been one.
```tsx
export async function action({ request }) {
  const body = await request.formData();
  const name = body.get("visitorsName");
  return { message: `Hello, ${name}` };
}
export default function Invoices() {
  const data = useActionData();
  return (
    <Form method="post">
      <input type="text" name="visitorsName" />
      {data ? data.message : "Waiting..."}
    </Form>
  );
}
```
## Signature
```tsx
function useActionData<T = any>(): SerializeFrom<T> | undefined
```
## Returns
The data returned from the route's [`action`](../../start/framework/route-module#action)
function, or `undefined` if no [`action`](../../start/framework/route-module#action)
has been called

---

## Page 43 — `docs/api/hooks/useAsyncError.md`

Live URL: https://reactrouter.com/api/hooks/useAsyncError

# useAsyncError
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useAsyncError.html)
Returns the rejection value from the closest [`<Await>`](../components/Await).
```tsx
function ErrorElement() {
  const error = useAsyncError();
  return (
    <p>Uh Oh, something went wrong! {error.message}</p>
  );
}
// somewhere in your app
<Await
  resolve={promiseThatRejects}
  errorElement={<ErrorElement />}
/>;
```
## Signature
```tsx
function useAsyncError(): unknown
```
## Returns
The error that was thrown in the nearest [`Await`](../components/Await) component

---

## Page 44 — `docs/api/hooks/useAsyncValue.md`

Live URL: https://reactrouter.com/api/hooks/useAsyncValue

# useAsyncValue
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useAsyncValue.html)
Returns the resolved promise value from the closest [`<Await>`](../components/Await).
```tsx
function SomeDescendant() {
  const value = useAsyncValue();
  // ...
}
// somewhere in your app
<Await resolve={somePromise}>
  <SomeDescendant />
</Await>;
```
## Signature
```tsx
function useAsyncValue(): unknown
```
## Returns
The resolved value from the nearest [`Await`](../components/Await) component

---

## Page 45 — `docs/api/hooks/useBeforeUnload.md`

Live URL: https://reactrouter.com/api/hooks/useBeforeUnload

# useBeforeUnload
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useBeforeUnload.html)
Set up a callback to be fired on [Window's `beforeunload` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).
## Signature
```tsx
function useBeforeUnload(
  callback: (event: BeforeUnloadEvent) => any,
  options?: {
    capture?: boolean;
  },
): void
```
## Params
### callback
The callback to be called when the [`beforeunload` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) is fired.
### options.capture
If `true`, the event will be captured during the capture phase. Defaults to `false`.
## Returns
No return value.

---

## Page 46 — `docs/api/hooks/useBlocker.md`

Live URL: https://reactrouter.com/api/hooks/useBlocker

# useBlocker
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useBlocker.html)
Allow the application to block navigations within the SPA and present the
user a confirmation dialog to confirm the navigation. Mostly used to avoid
using half-filled form data. This does not handle hard-reloads or
cross-origin navigations.
The [`Blocker`](https://api.reactrouter.com/v7/types/react-router.Blocker.html) object returned by the hook has the following properties:
- **`state`**
  - `unblocked` - the blocker is idle and has not prevented any navigation
  - `blocked` - the blocker has prevented a navigation
  - `proceeding` - the blocker is proceeding through from a blocked navigation
- **`location`**
  - When in a `blocked` state, this represents the [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html) to which
    we blocked a navigation. When in a `proceeding` state, this is the
    location being navigated to after a `blocker.proceed()` call.
- **`proceed()`**
  - When in a `blocked` state, you may call `blocker.proceed()` to proceed to
    the blocked location.
- **`reset()`**
  - When in a `blocked` state, you may call `blocker.reset()` to return the
    blocker to an `unblocked` state and leave the user at the current
    location.
```tsx
// Boolean version
let blocker = useBlocker(value !== "");
// Function version
let blocker = useBlocker(
  ({ currentLocation, nextLocation, historyAction }) =>
    value !== "" &&
    currentLocation.pathname !== nextLocation.pathname
);
```
## Signature
```tsx
function useBlocker(shouldBlock: boolean | BlockerFunction): Blocker
```
## Params
### shouldBlock
Either a boolean or a function returning a boolean which indicates whether the navigation should be blocked. The function format
receives a single object parameter containing the `currentLocation`,
`nextLocation`, and `historyAction` of the potential navigation.
## Returns
A [`Blocker`](https://api.reactrouter.com/v7/types/react-router.Blocker.html) object with state and reset functionality
## Examples
```tsx
export function ImportantForm() {
  const [value, setValue] = useState("");
  const shouldBlock = useCallback<BlockerFunction>(
    () => value !== "",
    [value]
  );
  const blocker = useBlocker(shouldBlock);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setValue("");
        if (blocker.state === "blocked") {
          blocker.proceed();
        }
      }}
    >
      <input
        name="data"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit">Save</button>
      {blocker.state === "blocked" ? (
        <>
          <p style={{ color: "red" }}>
            Blocked the last navigation to
          </p>
          <button
            type="button"
            onClick={() => blocker.proceed()}
          >
            Let me through
          </button>
          <button
            type="button"
            onClick={() => blocker.reset()}
          >
            Keep me here
          </button>
        </>
      ) : blocker.state === "proceeding" ? (
        <p style={{ color: "orange" }}>
          Proceeding through blocked navigation
        </p>
      ) : (
        <p style={{ color: "green" }}>
          Blocker is currently unblocked
        </p>
      )}
    </form>
  );
}
```

---

## Page 47 — `docs/api/hooks/useFetcher.md`

Live URL: https://reactrouter.com/api/hooks/useFetcher

# useFetcher
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useFetcher.html)
Useful for creating complex, dynamic user interfaces that require multiple,
concurrent data interactions without causing a navigation.
Fetchers track their own, independent state and can be used to load data, submit
forms, and generally interact with [`action`](../../start/framework/route-module#action)
and [`loader`](../../start/framework/route-module#loader) functions.
```tsx
} = ): FetcherWithComponents<SerializeFrom<T>> {}
```
## Params
### options.key
A unique key to identify the fetcher. 
By default, `useFetcher` generates a unique fetcher scoped to that component.
If you want to identify a fetcher with your own key such that you can access
it from elsewhere in your app, you can do that with the `key` option:
```tsx
function SomeComp() {
  let fetcher = useFetcher({ key: "my-key" })
  // ...
}
// Somewhere else
function AnotherComp() {
  // this will be the same fetcher, sharing the state across the app
  let fetcher = useFetcher({ key: "my-key" });
  // ...
}
```
## Returns
A [`FetcherWithComponents`](https://api.reactrouter.com/v7/types/react-router.FetcherWithComponents.html) object that contains the fetcher's state, data, and components for submitting forms and loading data.

---

## Page 48 — `docs/api/hooks/useFetchers.md`

Live URL: https://reactrouter.com/api/hooks/useFetchers

# useFetchers
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useFetchers.html)
Returns an array of all in-flight [`Fetcher`](https://api.reactrouter.com/v7/types/react-router.Fetcher.html)s. This is useful for components
throughout the app that didn't create the fetchers but want to use their submissions
to participate in optimistic UI.
```tsx
function SomeComponent() {
  const fetchers = useFetchers();
  fetchers[0].formData; // FormData
  fetchers[0].state; // etc.
  // ...
}
```
## Signature
```tsx
function useFetchers(): (Fetcher & {
  key: string;
})[]
```
## Returns
An array of all in-flight [`Fetcher`](https://api.reactrouter.com/v7/types/react-router.Fetcher.html)s, each with a unique `key`
property.

---

## Page 49 — `docs/api/hooks/useFormAction.md`

Live URL: https://reactrouter.com/api/hooks/useFormAction

# useFormAction
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useFormAction.html)
Resolves the URL to the closest route in the component hierarchy instead of
the current URL of the app.
This is used internally by [`Form`](../components/Form) to resolve the `action` to the closest
route, but can be used generically as well.
```ts
function SomeComponent() {
  // closest route URL
  let action = useFormAction();
  // closest route URL + "destroy"
  let destroyAction = useFormAction("destroy");
}
```
<docs-info>This hook adds a `basename` if your app specifies one, so that it
can be used with raw `<form>` elements in a progressively enhanced way.  If
you are using this to provide an `action` to `<Form>` or `fetcher.submit`, you
will need to remove the `basename` since both of those will prepend it
internally.</docs-info>
## Signature
```tsx
function useFormAction(
  action?: string,
  {
    relative,
  }: {
    relative?: RelativeRoutingType;
  } = ,
): string {}
```
## Params
### action
The action to append to the closest route URL. Defaults to the closest route URL.
### options.relative
The relative routing type to use when resolving the action. Defaults to `"route"`.
## Returns
The resolved action URL.

---

## Page 50 — `docs/api/hooks/useHref.md`

Live URL: https://reactrouter.com/api/hooks/useHref

# useHref
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useHref.html)
Resolves a URL against the current [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html).
```tsx
function SomeComponent() {
  let href = useHref("some/where");
  // "/resolved/some/where"
}
```
## Signature
```tsx
function useHref(
  to: To,
  {
    relative,
  }: {
    relative?: RelativeRoutingType;
  } = ,
): string {}
```
## Params
### to
The path to resolve
### options.relative
Defaults to `"route"` so routing is relative to the route tree.
Set to `"path"` to make relative routing operate against path segments.
## Returns
The resolved href string

---

## Page 51 — `docs/api/hooks/useInRouterContext.md`

Live URL: https://reactrouter.com/api/hooks/useInRouterContext

# useInRouterContext
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useInRouterContext.html)
Returns `true` if this component is a descendant of a [`Router`](../declarative-routers/Router), useful
to ensure a component is used within a [`Router`](../declarative-routers/Router).
## Signature
```tsx
function useInRouterContext(): boolean
```
## Returns
Whether the component is within a [`Router`](../declarative-routers/Router) context

---

## Page 52 — `docs/api/hooks/useLinkClickHandler.md`

Live URL: https://reactrouter.com/api/hooks/useLinkClickHandler

# useLinkClickHandler
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useLinkClickHandler.html)
Handles the click behavior for router [`<Link>`](../components/Link) components.This
is useful if you need to create custom [`<Link>`](../components/Link) components with
the same click behavior we use in our exported [`<Link>`](../components/Link).
## Signature
```tsx
function useLinkClickHandler<E extends Element = HTMLAnchorElement>(
  to: To,
  {
    target,
    replace: replaceProp,
    mask,
    state,
    preventScrollReset,
    relative,
    viewTransition,
    defaultShouldRevalidate,
    useTransitions,
  }: {
    target?: React.HTMLAttributeAnchorTarget;
    replace?: boolean;
    mask?: To;
    state?: any;
    preventScrollReset?: boolean;
    relative?: RelativeRoutingType;
    viewTransition?: boolean;
    defaultShouldRevalidate?: boolean;
    useTransitions?: boolean;
  } = ,
): (event: React.MouseEvent<E, MouseEvent>) => void {}
```
## Params
### to
The URL to navigate to, can be a string or a partial [`Path`](https://api.reactrouter.com/v7/interfaces/react-router.Path.html).
### options.preventScrollReset
Whether to prevent the scroll position from being reset to the top of the viewport on completion of the navigation when
using the [`ScrollRestoration`](../components/ScrollRestoration) component. Defaults to `false`.
### options.relative
The [relative routing type](https://api.reactrouter.com/v7/types/react-router.RelativeRoutingType.html) to use for the link. Defaults to `"route"`.
### options.replace
Whether to replace the current [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History) entry instead of pushing a new one. Defaults to `false`.
### options.state
The state to add to the [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History) entry for this navigation. Defaults to `undefined`.
### options.target
The target attribute for the link. Defaults to `undefined`.
### options.viewTransition
Enables a [View Transition](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) for this navigation. To apply specific styles during the transition, see
[`useViewTransitionState`](../hooks/useViewTransitionState). Defaults to `false`.
### options.defaultShouldRevalidate
Specify the default revalidation behavior for the navigation. Defaults to `true`.
### options.mask
Masked location to display in the browser instead of the router location. Defaults to `undefined`.
### options.useTransitions
Wraps the navigation in [`React.startTransition`](https://react.dev/reference/react/startTransition)
for concurrent rendering. Defaults to `false`.
## Returns
A click handler function that can be used in a custom [`Link`](../components/Link) component.

---

## Page 53 — `docs/api/hooks/useLoaderData.md`

Live URL: https://reactrouter.com/api/hooks/useLoaderData

# useLoaderData
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useLoaderData.html)
Returns the data from the closest route
[`loader`](../../start/framework/route-module#loader) or
[`clientLoader`](../../start/framework/route-module#clientloader).
```tsx
export async function loader() {
  return await fakeDb.invoices.findAll();
}
export default function Invoices() {
  let invoices = useLoaderData<typeof loader>();
  // ...
}
```
## Signature
```tsx
function useLoaderData<T = any>(): SerializeFrom<T>
```
## Returns
The data returned from the route's [`loader`](../../start/framework/route-module#loader) or [`clientLoader`](../../start/framework/route-module#clientloader) function

---

## Page 54 — `docs/api/hooks/useLocation.md`

Live URL: https://reactrouter.com/api/hooks/useLocation

# useLocation
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useLocation.html)
Returns the current [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html). This can be useful if you'd like to
perform some side effect whenever it changes.
```tsx
  return (
    // ...
  );
}
```
## Signature
```tsx
function useLocation(): Location
```
## Returns
The current [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html) object

---

## Page 55 — `docs/api/hooks/useMatch.md`

Live URL: https://reactrouter.com/api/hooks/useMatch

# useMatch
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useMatch.html)
Returns a [`PathMatch`](https://api.reactrouter.com/v7/interfaces/react-router.PathMatch.html) object if the given pattern matches the current URL.
This is useful for components that need to know "active" state, e.g.
[`<NavLink>`](../components/NavLink).
## Signature
```tsx
function useMatch<Path extends string>(
  pattern: PathPattern<Path> | Path,
): PathMatch<ParamParseKey<Path>> | null
```
## Params
### pattern
The pattern to match against the current [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html)
## Returns
The path match object if the pattern matches, `null` otherwise

---

## Page 56 — `docs/api/hooks/useMatches.md`

Live URL: https://reactrouter.com/api/hooks/useMatches

# useMatches
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useMatches.html)
Returns the active route matches, useful for accessing `loaderData` for
parent/child routes or the route [`handle`](../../start/framework/route-module#handle)
property
## Signature
```tsx
function useMatches(): UIMatch[]
```
## Returns
An array of [UI matches](https://api.reactrouter.com/v7/interfaces/react-router.UIMatch.html) for the current route hierarchy

---

## Page 57 — `docs/api/hooks/useNavigate.md`

Live URL: https://reactrouter.com/api/hooks/useNavigate

# useNavigate
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useNavigate.html)
Returns a function that lets you navigate programmatically in the browser in
response to user interactions or effects.
It's often better to use [`redirect`](../utils/redirect) in [`action`](../../start/framework/route-module#action)/[`loader`](../../start/framework/route-module#loader)
functions than this hook.
The returned function signature is `navigate(to, options?)`/`navigate(delta)` where:
* `to` can be a string path, a [`To`](https://api.reactrouter.com/v7/types/react-router.To.html) object, or a number (delta)
* `options` contains options for modifying the navigation
  * These options work in all modes (Framework, Data, and Declarative):
    * `relative`: `"route"` or `"path"` to control relative routing logic
    * `replace`: Replace the current entry in the [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History) stack
    * `state`: Optional [`history.state`](https://developer.mozilla.org/en-US/docs/Web/API/History/state) to include with the new [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html)
  * These options only work in Framework and Data modes:
    * `flushSync`: Wrap the DOM updates in [`ReactDom.flushSync`](https://react.dev/reference/react-dom/flushSync)
    * `preventScrollReset`: Do not scroll back to the top of the page after navigation
    * `viewTransition`: Enable [`document.startViewTransition`](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) for this navigation
```tsx
function SomeComponent() {
  let navigate = useNavigate();
  return (
    <button onClick={() => navigate(-1)}>
      Go Back
    </button>
  );
}
```
## Signature
```tsx
function useNavigate(): NavigateFunction
```
## Returns
A navigate function for programmatic navigation
## Examples
### Navigate to another path
```tsx
navigate("/some/route");
navigate("/some/route?search=param");
```
### Navigate with a [`To`](https://api.reactrouter.com/v7/types/react-router.To.html) object
All properties are optional.
```tsx
navigate({
  pathname: "/some/route",
  search: "?search=param",
  hash: "#hash",
  state: { some: "state" },
});
```
If you use `state`, that will be available on the [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html) object on
the next page. Access it with `useLocation().state` (see [`useLocation`](../hooks/useLocation)).
### Navigate back or forward in the history stack
```tsx
// back
// often used to close modals
navigate(-1);
// forward
// often used in a multistep wizard workflows
navigate(1);
```
Be cautious with `navigate(number)`. If your application can load up to a
route that has a button that tries to navigate forward/back, there may not be
a [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
entry to go back or forward to, or it can go somewhere you don't expect
(like a different domain).
Only use this if you're sure they will have an entry in the [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
stack to navigate to.
### Replace the current entry in the history stack
This will remove the current entry in the [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
stack, replacing it with a new one, similar to a server side redirect.
```tsx
navigate("/some/route", { replace: true });
```
### Prevent Scroll Reset
[MODES: framework, data]
<br/>
<br/>
To prevent [`<ScrollRestoration>`](../components/ScrollRestoration) from resetting
the scroll position, use the `preventScrollReset` option.
```tsx
navigate("?some-tab=1", { preventScrollReset: true });
```
For example, if you have a tab interface connected to search params in the
middle of a page, and you don't want it to scroll to the top when a tab is
clicked.
### Return Type Augmentation
Internally, `useNavigate` uses a separate implementation when you are in
Declarative mode versus Data/Framework mode - the primary difference being
that the latter is able to return a stable reference that does not change
identity across navigations. The implementation in Data/Framework mode also
returns a [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
that resolves when the navigation is completed. This means the return type of
`useNavigate` is `void | Promise<void>`. This is accurate, but can lead to
some red squigglies based on the union in the return value:
- If you're using `typescript-eslint`, you may see errors from
  [`@typescript-eslint/no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises)
- In Framework/Data mode, `React.use(navigate())` will show a false-positive
  `Argument of type 'void | Promise<void>' is not assignable to parameter of
  type 'Usable<void>'` error
The easiest way to work around these issues is to augment the type based on the
router you're using:
```ts
// If using <BrowserRouter>
declare module "react-router" {
  interface NavigateFunction {
    (to: To, options?: NavigateOptions): void;
    (delta: number): void;
  }
}
// If using <RouterProvider> or Framework mode
declare module "react-router" {
  interface NavigateFunction {
    (to: To, options?: NavigateOptions): Promise<void>;
    (delta: number): Promise<void>;
  }
}
```

---

## Page 58 — `docs/api/hooks/useNavigation.md`

Live URL: https://reactrouter.com/api/hooks/useNavigation

# useNavigation
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useNavigation.html)
Returns the current [`Navigation`](https://api.reactrouter.com/v7/types/react-router.Navigation.html), defaulting to an "idle" navigation
when no navigation is in progress. You can use this to render pending UI
(like a global spinner) or read [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
from a form navigation.
```tsx
function SomeComponent() {
  let navigation = useNavigation();
  navigation.state;
  navigation.formData;
  // etc.
}
```
## Signature
```tsx
function useNavigation(): Omit<Navigation, "matches" | "historyAction">
```
## Returns
The current [`Navigation`](https://api.reactrouter.com/v7/types/react-router.Navigation.html) object

---

## Page 59 — `docs/api/hooks/useNavigationType.md`

Live URL: https://reactrouter.com/api/hooks/useNavigationType

# useNavigationType
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useNavigationType.html)
Returns the current [`Navigation`](https://api.reactrouter.com/v7/types/react-router.Navigation.html) action which describes how the router
came to the current [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html), either by a pop, push, or replace on
the [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History) stack.
## Signature
```tsx
function useNavigationType(): NavigationType
```
## Returns
The current [`NavigationType`](https://api.reactrouter.com/v7/enums/react-router.NavigationType.html) (`"POP"`, `"PUSH"`, or `"REPLACE"`)

---

## Page 60 — `docs/api/hooks/useOutlet.md`

Live URL: https://reactrouter.com/api/hooks/useOutlet

# useOutlet
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useOutlet.html)
Returns the element for the child route at this level of the route
hierarchy. Used internally by [`<Outlet>`](../components/Outlet) to render child
routes.
## Signature
```tsx
function useOutlet(context?: unknown): React.ReactElement | null
```
## Params
### context
The context to pass to the outlet
## Returns
The child route element or `null` if no child routes match

---

## Page 61 — `docs/api/hooks/useOutletContext.md`

Live URL: https://reactrouter.com/api/hooks/useOutletContext

# useOutletContext
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useOutletContext.html)
Returns the parent route [`<Outlet context>`](../components/Outlet).
Often parent routes manage state or other values you want shared with child
routes. You can create your own [context provider](https://react.dev/learn/passing-data-deeply-with-context)
if you like, but this is such a common situation that it's built-into
[`<Outlet>`](../components/Outlet).
```tsx
// Parent route
function Parent() {
  const [count, setCount] = React.useState(0);
  return <Outlet context={[count, setCount]} />;
}
```
```tsx
// Child route
function Child() {
  const [count, setCount] = useOutletContext();
  const increment = () => setCount((c) => c + 1);
  return <button onClick={increment}>{count}</button>;
}
```
If you're using TypeScript, we recommend the parent component provide a
custom hook for accessing the context value. This makes it easier for
consumers to get nice typings, control consumers, and know who's consuming
the context value.
Here's a more realistic example:
```tsx filename=src/routes/dashboard.tsx lines=[14,20]
type ContextType = { user: User | null };
export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  return (
    <div>
      <h1>Dashboard</h1>
      <Outlet context={{ user } satisfies ContextType} />
    </div>
  );
}
export function useUser() {
  return useOutletContext<ContextType>();
}
```
```tsx filename=src/routes/dashboard/messages.tsx lines=[1,4]
export default function DashboardMessages() {
  const { user } = useUser();
  return (
    <div>
      <h2>Messages</h2>
      <p>Hello, {user.name}!</p>
    </div>
  );
}
```
## Signature
```tsx
function useOutletContext<Context = unknown>(): Context
```
## Returns
The context value passed to the parent [`Outlet`](../components/Outlet) component

---

## Page 62 — `docs/api/hooks/useParams.md`

Live URL: https://reactrouter.com/api/hooks/useParams

# useParams
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useParams.html)
Returns an object of key/value-pairs of the dynamic params from the current
URL that were matched by the routes. Child routes inherit all params from
their parent routes.
Assuming a route pattern like `/posts/:postId` is matched by `/posts/123`
then `params.postId` will be `"123"`.
```tsx
function SomeComponent() {
  let params = useParams();
  params.postId;
}
```
## Signature
```tsx
function useParams<
  ParamsOrKey extends string | Record<string, string | undefined> = string,
>(): Readonly<
  [ParamsOrKey] extends [string] ? Params<ParamsOrKey> : Partial<ParamsOrKey>
>
```
## Returns
An object containing the dynamic route parameters
## Examples
### Basic Usage
```tsx
// given a route like:
<Route path="/posts/:postId" element={<Post />} />;
// or a data route like:
createBrowserRouter([
  {
    path: "/posts/:postId",
    component: Post,
  },
]);
// or in routes.ts
route("/posts/:postId", "routes/post.tsx");
```
Access the params in a component:
```tsx
export default function Post() {
  let params = useParams();
  return <h1>Post: {params.postId}</h1>;
}
```
### Multiple Params
Patterns can have multiple params:
```tsx
"/posts/:postId/comments/:commentId";
```
All will be available in the params object:
```tsx
export default function Post() {
  let params = useParams();
  return (
    <h1>
      Post: {params.postId}, Comment: {params.commentId}
    </h1>
  );
}
```
### Catchall Params
Catchall params are defined with `*`:
```tsx
"/files/*";
```
The matched value will be available in the params object as follows:
```tsx
export default function File() {
  let params = useParams();
  let catchall = params["*"];
  // ...
}
```
You can destructure the catchall param:
```tsx
export default function File() {
  let { "*": catchall } = useParams();
  console.log(catchall);
}
```

---

## Page 63 — `docs/api/hooks/usePrompt.md`

Live URL: https://reactrouter.com/api/hooks/usePrompt

# unstable_usePrompt
[MODES: framework, data]
<br />
<br />
<docs-warning>This API is experimental and subject to breaking changes in 
minor/patch releases. Please use with caution and pay **very** close attention 
to release notes for relevant changes.</docs-warning>
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.unstable_usePrompt.html)
Wrapper around [`useBlocker`](../hooks/useBlocker) to show a [`window.confirm`](https://developer.mozilla.org/en-US/docs/Web/API/Window/confirm)
prompt to users instead of building a custom UI with [`useBlocker`](../hooks/useBlocker).
The `unstable_` flag will not be removed because this technique has a lot of
rough edges and behaves very differently (and incorrectly sometimes) across
browsers if users click addition back/forward navigations while the
confirmation is open. Use at your own risk.
```tsx
function ImportantForm() {
  let [value, setValue] = React.useState("");
  // Block navigating elsewhere when data has been entered into the input
  unstable_usePrompt({
    message: "Are you sure?",
    when: ({ currentLocation, nextLocation }) =>
      value !== "" &&
      currentLocation.pathname !== nextLocation.pathname,
  });
  return (
    <Form method="post">
      <label>
        Enter some important data:
        <input
          name="data"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <button type="submit">Save</button>
    </Form>
  );
}
```
## Signature
```tsx
function usePrompt({
  when,
  message,
}: {
  when: boolean | BlockerFunction;
  message: string;
}): void
```
## Params
### options.message
The message to show in the confirmation dialog.
### options.when
A boolean or a function that returns a boolean indicating whether to block the navigation. If a function is provided, it will receive an
object with `currentLocation` and `nextLocation` properties.
## Returns
No return value.

---

## Page 64 — `docs/api/hooks/useResolvedPath.md`

Live URL: https://reactrouter.com/api/hooks/useResolvedPath

# useResolvedPath
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useResolvedPath.html)
Resolves the pathname of the given `to` value against the current
[`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html). Similar to [`useHref`](../hooks/useHref), but returns a
[`Path`](https://api.reactrouter.com/v7/interfaces/react-router.Path.html) instead of a string.
```tsx
function SomeComponent() {
  // if the user is at /dashboard/profile
  let path = useResolvedPath("../accounts");
  path.pathname; // "/dashboard/accounts"
  path.search; // ""
  path.hash; // ""
}
```
## Signature
```tsx
function useResolvedPath(
  to: To,
  {
    relative,
  }: {
    relative?: RelativeRoutingType;
  } = ,
): Path {}
```
## Params
### to
The path to resolve
### options.relative
Defaults to `"route"` so routing is relative to the route tree.                         Set to `"path"` to make relative routing operate against path segments.
## Returns
The resolved [`Path`](https://api.reactrouter.com/v7/interfaces/react-router.Path.html) object with `pathname`, `search`, and `hash`

---

## Page 65 — `docs/api/hooks/useRevalidator.md`

Live URL: https://reactrouter.com/api/hooks/useRevalidator

# useRevalidator
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useRevalidator.html)
Revalidate the data on the page for reasons outside of normal data mutations
like [`Window` focus](https://developer.mozilla.org/en-US/docs/Web/API/Window/focus_event)
or polling on an interval.
Note that page data is already revalidated automatically after actions.
If you find yourself using this for normal CRUD operations on your data in
response to user interactions, you're probably not taking advantage of the
other APIs like [`useFetcher`](../hooks/useFetcher), [`Form`](../components/Form), [`useSubmit`](../hooks/useSubmit) that do
this automatically.
```tsx
function WindowFocusRevalidator() {
  const revalidator = useRevalidator();
  useFakeWindowFocus(() => {
    revalidator.revalidate();
  });
  return (
    <div hidden={revalidator.state === "idle"}>
      Revalidating...
    </div>
  );
}
```
## Signature
```tsx
function useRevalidator(): {
  revalidate: () => Promise<void>;
  state: DataRouter["state"]["revalidation"];
}
```
## Returns
An object with a `revalidate` function and the current revalidation
`state`

---

## Page 66 — `docs/api/hooks/useRouteError.md`

Live URL: https://reactrouter.com/api/hooks/useRouteError

# useRouteError
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useRouteError.html)
Accesses the error thrown during an
[`action`](../../start/framework/route-module#action),
[`loader`](../../start/framework/route-module#loader),
or component render to be used in a route module
[`ErrorBoundary`](../../start/framework/route-module#errorboundary).
```tsx
export function ErrorBoundary() {
  const error = useRouteError();
  return <div>{error.message}</div>;
}
```
## Signature
```tsx
function useRouteError(): unknown
```
## Returns
The error that was thrown during route [loading](../../start/framework/route-module#loader),
[`action`](../../start/framework/route-module#action) execution, or rendering

---

## Page 67 — `docs/api/hooks/useRouteLoaderData.md`

Live URL: https://reactrouter.com/api/hooks/useRouteLoaderData

# useRouteLoaderData
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useRouteLoaderData.html)
Returns the [`loader`](../../start/framework/route-module#loader) data for a
given route by route ID.
Route IDs are created automatically. They are simply the path of the route file
relative to the app folder without the extension.
| Route Filename               | Route ID               |
| ---------------------------- | ---------------------- |
| `app/root.tsx`               | `"root"`               |
| `app/routes/teams.tsx`       | `"routes/teams"`       |
| `app/whatever/teams.$id.tsx` | `"whatever/teams.$id"` |
```tsx
function SomeComponent() {
  const { user } = useRouteLoaderData("root");
}
// You can also specify your own route ID's manually in your routes.ts file:
route("/", "containers/app.tsx", { id: "app" })
useRouteLoaderData("app");
```
## Signature
```tsx
function useRouteLoaderData<T = any>(
  routeId: string,
): SerializeFrom<T> | undefined
```
## Params
### routeId
The ID of the route to return loader data from
## Returns
The data returned from the specified route's [`loader`](../../start/framework/route-module#loader)
function, or `undefined` if not found

---

## Page 68 — `docs/api/hooks/useRouterState.md`

Live URL: https://reactrouter.com/api/hooks/useRouterState

# unstable_useRouterState
[MODES: framework, data]
<br />
<br />
<docs-warning>This API is experimental and subject to breaking changes in 
minor/patch releases. Please use with caution and pay **very** close attention 
to release notes for relevant changes.</docs-warning>
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.unstable_useRouterState.html)
A unified hook for reading router state: current (`active`) and in-flight
(`pending`) locations, search params, params, matches, and navigation type.
This hook consolidates the information you used to get from [`useLocation`](../hooks/useLocation),
[`useSearchParams`](../hooks/useSearchParams), [`useParams`](../hooks/useParams), [`useMatches`](../hooks/useMatches), [`useNavigation`](../hooks/useNavigation),
and [`useNavigationType`](../hooks/useNavigationType) into a single hook.
```tsx
let { active, pending } = unstable_useRouterState();
// Active is always populated with the current location
active.location; // replaces `useLocation()`
active.searchParams; // replaces `useSearchParams()[0]`
active.params; // replaces `useParams()`
active.matches; // replaces `useMatches()`
active.type; // replaces `useNavigationType()`
// Pending is only populated during a navigation
pending.location; // replaces `useNavigation().location`
pending.searchParams; // equivalent to `new URLSearchParams(useNavigation().search)`
pending.params; // Not directly accessible today
pending.matches; // Not directly accessible today
pending.type; // Not directly accessible today
pending.state; // replaces `useNavigation().state`
pending.formMethod; // replaces useNavigation().formMethod
pending.formAction; // replaces useNavigation().formAction
pending.formEncType; // replaces useNavigation().formEncType
pending.formData; // replaces useNavigation().formData
pending.json; // replaces useNavigation().json
pending.text; // replaces useNavigation().text
```
## Signature
```tsx
function useRouterState(): unstable_RouterState
```
## Returns
The current router state with `active` and `pending` variants

---

## Page 69 — `docs/api/hooks/useRoutes.md`

Live URL: https://reactrouter.com/api/hooks/useRoutes

# useRoutes
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useRoutes.html)
Hook version of [`<Routes>`](../components/Routes) that uses objects instead of
components. These objects have the same properties as the component props.
The return value of `useRoutes` is either a valid React element you can use
to render the route tree, or `null` if nothing matched.
```tsx
function App() {
  let element = useRoutes([
    {
      path: "/",
      element: <Dashboard />,
      children: [
        {
          path: "messages",
          element: <DashboardMessages />,
        },
        { path: "tasks", element: <DashboardTasks /> },
      ],
    },
    { path: "team", element: <AboutPage /> },
  ]);
  return element;
}
```
## Signature
```tsx
function useRoutes(
  routes: RouteObject[],
  locationArg?: Partial<Location> | string,
): React.ReactElement | null
```
## Params
### routes
An array of [`RouteObject`](https://api.reactrouter.com/v7/types/react-router.RouteObject.html)s that define the route hierarchy
### locationArg
An optional [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html) object or pathname string to use instead of the current [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html)
## Returns
A React element to render the matched route, or `null` if no routes matched

---

## Page 70 — `docs/api/hooks/useSearchParams.md`

Live URL: https://reactrouter.com/api/hooks/useSearchParams

# useSearchParams
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useSearchParams.html)
Returns a tuple of the current URL's [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)
and a function to update them. Setting the search params causes a navigation.
```tsx
export function SomeComponent() {
  const [searchParams, setSearchParams] = useSearchParams();
  // ...
}
```
### `setSearchParams` function
The second element of the tuple is a function that can be used to update the
search params. It accepts the same types as `defaultInit` and will cause a
navigation to the new URL.
```tsx
let [searchParams, setSearchParams] = useSearchParams();
// a search param string
setSearchParams("?tab=1");
// a shorthand object
setSearchParams({ tab: "1" });
// object keys can be arrays for multiple values on the key
setSearchParams({ brand: ["nike", "reebok"] });
// an array of tuples
setSearchParams([["tab", "1"]]);
// a `URLSearchParams` object
setSearchParams(new URLSearchParams("?tab=1"));
```
It also supports a function callback like React's
[`setState`](https://react.dev/reference/react/useState#setstate):
```tsx
setSearchParams((searchParams) => {
  searchParams.set("tab", "2");
  return searchParams;
});
```
<docs-warning>The function callback version of `setSearchParams` does not support
the [queueing](https://react.dev/reference/react/useState#setstate-parameters)
logic that React's `setState` implements.  Multiple calls to `setSearchParams`
in the same tick will not build on the prior value.  If you need this behavior,
you can use `setState` manually.</docs-warning>
### Notes
Note that `searchParams` is a stable reference, so you can reliably use it
as a dependency in React's [`useEffect`](https://react.dev/reference/react/useEffect)
hooks.
```tsx
useEffect(() => {
  console.log(searchParams.get("tab"));
}, [searchParams]);
```
However, this also means it's mutable. If you change the object without
calling `setSearchParams`, its values will change between renders if some
other state causes the component to re-render and URL will not reflect the
values.
## Signature
```tsx
function useSearchParams(
  defaultInit?: URLSearchParamsInit,
): [URLSearchParams, SetURLSearchParams]
```
## Params
### defaultInit
You can initialize the search params with a default value, though it **will
not** change the URL on the first render.
```tsx
// a search param string
useSearchParams("?tab=1");
// a shorthand object
useSearchParams({ tab: "1" });
// object keys can be arrays for multiple values on the key
useSearchParams({ brand: ["nike", "reebok"] });
// an array of tuples
useSearchParams([["tab", "1"]]);
// a `URLSearchParams` object
useSearchParams(new URLSearchParams("?tab=1"));
```
## Returns
A tuple of the current [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)
and a function to update them.

---

## Page 71 — `docs/api/hooks/useSubmit.md`

Live URL: https://reactrouter.com/api/hooks/useSubmit

# useSubmit
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useSubmit.html)
The imperative version of [`<Form>`](../components/Form) that lets you submit a form
from code instead of a user interaction.
```tsx
function SomeComponent() {
  const submit = useSubmit();
  return (
    <Form onChange={(event) => submit(event.currentTarget)} />
  );
}
```
## Signature
```tsx
function useSubmit(): SubmitFunction
```
## Returns
A function that can be called to submit a [`Form`](../components/Form) imperatively.

---

## Page 72 — `docs/api/hooks/useViewTransitionState.md`

Live URL: https://reactrouter.com/api/hooks/useViewTransitionState

# useViewTransitionState
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.useViewTransitionState.html)
This hook returns `true` when there is an active [View Transition](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)
and the specified location matches either side of the navigation (the URL you are
navigating **to** or the URL you are navigating **from**). This can be used to apply finer-grained styles to
elements to further customize the view transition. This requires that view
transitions have been enabled for the given navigation via [`LinkProps.viewTransition`](https://api.reactrouter.com/v7/interfaces/react-router.LinkProps.html#viewTransition)
(or the `Form`, `submit`, or `navigate` call)
## Signature
```tsx
function useViewTransitionState(
  to: To,
  {
    relative,
  }: {
    relative?: RelativeRoutingType;
  } = ,
) {}
```
## Params
### to
The [`To`](https://api.reactrouter.com/v7/types/react-router.To.html) location to compare against the active transition's current and next URLs.
### options.relative
The relative routing type to use when resolving the `to` location, defaults to `"route"`. See [`RelativeRoutingType`](https://api.reactrouter.com/v7/types/react-router.RelativeRoutingType.html) for
more details.
## Returns
`true` if there is an active [View Transition](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)
and the resolved path matches the transition's destination or source pathname, otherwise `false`.

---

## Page 73 — `docs/api/index.md`

Live URL: https://reactrouter.com/api/index



---

## Page 74 — `docs/api/other-api/adapter.md`

Live URL: https://reactrouter.com/api/other-api/adapter

# Server Adapters
## Official Adapters
Idiomatic React Router apps can generally be deployed anywhere because React Router adapts the server's request/response to the [Web Fetch API][web-fetch-api]. It does this through adapters. We maintain a few adapters:
- `@react-router/architect`
- `@react-router/cloudflare`
- `@react-router/express`
These adapters are imported into your server's entry and are not used inside your React Router app itself.
If you initialized your app with `npx create-react-router@latest` with something other than the built-in [React Router App Server][rr-serve] (`@react-router/serve`), you will note a `server/index.js` file that imports and uses one of these adapters.
<docs-info>If you're using the built-in React Router App Server, you don't interact with this API</docs-info>
Each adapter has the same API. In the future, we may have helpers specific to the platform you're deploying to.
## `@react-router/express`
[Reference Documentation ↗](https://api.reactrouter.com/v7/modules/_react-router_express.html)
Here's an example with [Express][express]:
```ts lines=[1-3,11-22]
const {
  createRequestHandler,
} = require("@react-router/express");
const express = require("express");
const app = express();
// needs to handle all verbs (GET, POST, etc.)
app.all(
  "*",
  createRequestHandler({
    // `react-router build` and `react-router dev` output files to a build directory,
    // you need to pass that build to the request handler
    build: require("./build"),
    // Return anything you want here to be available as `context` in your
    // loaders and actions. This is where you can bridge the gap between your
    // server and React Router
    getLoadContext(req, res) {
      return {};
    },
  }),
);
```
### Migrating from the React Router App Server
If you started an app with the [React Router App Server][rr-serve] but find that you want to take control over the Express server and customize it, it should be fairly straightforward to migrate way from `@react-router/serve`.
You can refer to the [Express template][express-template] as a reference, but here are the main changes you will need to make:
**1. Update deps**
```shellscript nonumber
npm uninstall @react-router/serve
npm install @react-router/express compression express morgan cross-env
npm install --save-dev @types/express @types/express-serve-static-core @types/morgan
```
**2. Add a server**
Create your React Router Express server in `server/app.ts`:
```ts filename=server/app.ts
app.use(
  createRequestHandler({
    build: () =>
      import("virtual:react-router/server-build"),
  }),
);
```
Copy the [`server.js`][express-template-server-js] into your app. This is the boilerplate setup we recommend to allow the same server code to run both the development and production builds of your app. Two separate files are used here so that the main Express server code can be written in TypeScript (`server/app.ts`) and compiled into your server build by React Router, and then executed via `node server.js`.
**3. Update `vite.config.ts` to compile the server**
```tsx filename=vite.config.ts lines=[6-10]
export default defineConfig(({ isSsrBuild }) => ({
  build: {
    rollupOptions: isSsrBuild
      ? { input: "./server/app.ts" }
      : undefined,
  },
  plugins: [reactRouter(), tsconfigPaths()],
}));
```
**4. Update `package.json` scripts**
Update the `dev` and `start` scripts to use your new Express server:
```json filename=package.json
{
  // ...
  "scripts": {
    "dev": "cross-env NODE_ENV=development node server.js",
    "start": "node server.js"
    // ...
  }
  // ...
}
```
## `@react-router/cloudflare`
[Reference Documentation ↗](https://api.reactrouter.com/v7/modules/_react-router_cloudflare.html)
Here's an example with Cloudflare:
```ts
declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}
const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);
export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
```
## `@react-router/node`
While not a direct "adapter" like the above, this package contains utilities for working with Node-based adapters.
[Reference Documentation ↗](https://api.reactrouter.com/v7/modules/_react-router_node.html)
### Node Version Support
React Router officially supports **Active** and **Maintenance** [Node LTS versions][node-releases] at any given point in time. Dropped support for End of Life Node versions is done in a React Router Minor release.
[express]: https://expressjs.com
[node-releases]: https://nodejs.org/en/about/previous-releases
[web-fetch-api]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[rr-serve]: ./serve
[express-template]: https://github.com/remix-run/react-router-templates/tree/main/node-custom-server
[express-template-server-js]: https://github.com/remix-run/react-router-templates/blob/main/node-custom-server/server.js

---

## Page 75 — `docs/api/other-api/dev.md`

Live URL: https://reactrouter.com/api/other-api/dev

# React Router CLI
The React Router CLI comes from the `@react-router/dev` package. Make sure it is in your `package.json` `devDependencies` so it doesn't get deployed to your server.
To get a full list of available commands and flags, run:
```shellscript nonumber
npx @react-router/dev -h
```
## `react-router build`
Builds your app for production with [Vite][vite]. This command will set `process.env.NODE_ENV` to `production` and minify the output for deployment.
```shellscript nonumber
react-router build
```
| Flag                  | Description                                             | Type                                                | Default     |
| --------------------- | ------------------------------------------------------- | --------------------------------------------------- | ----------- |
| `--assetsInlineLimit` | Static asset base64 inline threshold in bytes           | `number`                                            | `4096`      |
| `--clearScreen`       | Allow/disable clear screen when logging                 | `boolean`                                           |             |
| `--config`, `-c`      | Use specified config file                               | `string`                                            |             |
| `--emptyOutDir`       | Force empty outDir when it's outside of root            | `boolean`                                           |             |
| `--logLevel`, `-l`    | Use specified log level                                 | `"info" \| "warn" \| "error" \| "silent" \| string` |             |
| `--minify`            | Enable/disable minification, or specify minifier to use | `boolean \| "terser" \| "esbuild"`                  | `"esbuild"` |
| `--mode`, `-m`        | Set env mode                                            | `string`                                            |             |
| `--profile`           | Start built-in Node.js inspector                        |                                                     |             |
| `--sourcemapClient`   | Output source maps for client build                     | `boolean \| "inline" \| "hidden"`                   | `false`     |
| `--sourcemapServer`   | Output source maps for server build                     | `boolean \| "inline" \| "hidden"`                   | `false`     |
## `react-router dev`
Runs your app in development mode with HMR and Hot Data Revalidation (HDR), powered by [Vite][vite].
```shellscript nonumber
react-router dev
```
<docs-info>
What is "Hot Data Revalidation"?
Like HMR, HDR is a way of hot updating your app without needing to refresh the page.
That way you can keep your app state as your edits are applied in your app.
HMR handles client-side code updates like when you change the components, markup, or styles in your app.
Likewise, HDR handles server-side code updates.
That means any time you make a change to the current page (or any code that your current page depends on), React Router will re-fetch data from your [loaders][loaders].
That way your app is _always_ up to date with the latest code changes, client-side or server-side.
</docs-info>
| Flag               | Description                                           | Type                                                | Default |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------- | ------- |
| `--clearScreen`    | Allow/disable clear screen when logging               | `boolean`                                           |         |
| `--config`, `-c`   | Use specified config file                             | `string`                                            |         |
| `--cors`           | Enable CORS                                           | `boolean`                                           |         |
| `--force`          | Force the optimizer to ignore the cache and re-bundle | `boolean`                                           |         |
| `--host`           | Specify hostname                                      | `string`                                            |         |
| `--logLevel`, `-l` | Use specified log level                               | `"info" \| "warn" \| "error" \| "silent" \| string` |         |
| `--mode`, `-m`     | Set env mode                                          | `string`                                            |         |
| `--open`           | Open browser on startup                               | `boolean \| string`                                 |         |
| `--port`           | Specify port                                          | `number`                                            |         |
| `--profile`        | Start built-in Node.js inspector                      |                                                     |         |
| `--strictPort`     | Exit if specified port is already in use              | `boolean`                                           |         |
## `react-router reveal`
React Router handles the entry points of your application by default.
If you want to have control over these entry points, you can run `npx react-router reveal` to generate the [`entry.client.tsx`][entry-client] and [`entry.server.tsx`][entry-server] files in your `app` directory. When these files are present, React Router will use them instead of the defaults.
```shellscript nonumber
npx react-router reveal
```
| Flag              | Description                     | Type      | Default |
| ----------------- | ------------------------------- | --------- | ------- |
| `--config`, `-c`  | Use specified config file       | `string`  |         |
| `--mode`, `-m`    | Set env mode                    | `string`  |         |
| `--no-typescript` | Generate plain JavaScript files | `boolean` | `false` |
| `--typescript`    | Generate TypeScript files       | `boolean` | `true`  |
## `react-router routes`
Prints the routes in your app to the terminal.
```shellscript nonumber
react-router routes
```
Your route tree will be in a JSX format by default. You can also use the `--json` flag to get the routes in a JSON format.
```shellscript nonumber
react-router routes --json
```
| Flag             | Description                  | Type      | Default |
| ---------------- | ---------------------------- | --------- | ------- |
| `--config`, `-c` | Use specified config file    | `string`  |         |
| `--json`         | Output routes in JSON format | `boolean` | `false` |
| `--mode`, `-m`   | Set env mode                 | `string`  |         |
## `react-router typegen`
Generates TypeScript types for your routes. This happens automatically during development, but you can manually run it when needed, e.g., to generate types in CI before running `tsc`.  See [Type Safety][type-safety] for more information.
```shellscript nonumber
react-router typegen
```
| Flag             | Description               | Type      | Default |
| ---------------- | ------------------------- | --------- | ------- |
| `--config`, `-c` | Use specified config file | `string`  |         |
| `--mode`, `-m`   | Set env mode              | `string`  |         |
| `--watch`        | Watch for changes         | `boolean` | `false` |
[loaders]: ../../start/framework/data-loading
[vite]: https://vite.dev
[entry-server]: ../framework-conventions/entry.server.tsx
[entry-client]: ../framework-conventions/entry.client.tsx
[type-safety]: ../../explanation/type-safety

---

## Page 76 — `docs/api/other-api/index.md`

Live URL: https://reactrouter.com/api/other-api/index



---

## Page 77 — `docs/api/other-api/serve.md`

Live URL: https://reactrouter.com/api/other-api/serve

# React Router App Server
React Router is designed for you to own your server, but if you don't want to set one up, you can use the React Router App Server instead. It's a production-ready but basic Node.js server built with [Express][express].
By design, we do not provide options to customize the React Router App Server because if you need to customize the underlying `express` server, we'd rather you manage the server completely instead of creating an abstraction to handle all the possible customizations you may require. If you find you want to customize it, you can [migrate to the `@react-router/express` adapter][migrate-to-express].
You can see the underlying `express` server configuration in [packages/react-router-serve/cli.ts][rr-serve-code]. By default, it uses the following Express middlewares (please refer to their documentation for default behaviors):
- [`compression`][compression]
- [`express.static`][express-static] (and thus [`serve-static`][serve-static])
- [`morgan`][morgan]
## Usage
Install `@react-router/serve`:
```sh nonumber
npm install @react-router/serve
```
Run the server with your server build:
```sh nonumber
react-router-serve <server-build-path>
# e.g.
react-router-serve build/index.js
```
## `HOST` environment variable
You can configure the hostname for your Express app via `process.env.HOST` and that value will be passed to the internal [`app.listen`][express-listen] method when starting the server.
```shellscript nonumber
HOST=127.0.0.1 npx react-router-serve build/index.js
```
## `PORT` environment variable
You can change the port of the server with an environment variable.
```shellscript nonumber
PORT=4000 npx react-router-serve build/index.js
```
## Development Environment
Depending on `process.env.NODE_ENV`, the server will boot in development or production mode.
The `server-build-path` needs to point to the `serverBuildPath` defined in [`react-router.config.ts`][rr-config].
Because only the build artifacts (`build/`, `public/build/`) need to be deployed to production, the `react-router.config.ts` is not guaranteed to be available in production, so you need to tell React Router where your server build is with this option.
In development, `@react-router/serve` will ensure the latest code is run by purging the `require` cache for every request. This has some effects on your code you might need to be aware of:
- Any values in the module scope will be "reset"
  ```tsx lines=[1-3]
  // this will be reset for every request because the module cache was
  // cleared and this will be required brand new
  const cache = new Map();
  export async function loader({
    params,
  }: Route.LoaderArgs) {
    if (cache.has(params.foo)) {
      return cache.get(params.foo);
    }
    const record = await fakeDb.stuff.find(params.foo);
    cache.set(params.foo, record);
    return record;
  }
  ```
  If you need a workaround for preserving cache in development, you can set up a singleton in your server.
- Any **module side effects** will remain in place! This may cause problems but should probably be avoided anyway.
  ```tsx lines=[1-4]
  // this starts running the moment the module is imported
  setInterval(() => {
    console.log(Date.now());
  }, 1000);
  export async function loader() {
    // ...
  }
  ```
  If you need to write your code in a way that has these types of module side effects, you should set up your own [@react-router/express][rr-express] server and a tool in development like [`pm2-dev`][pm2-dev] or [`nodemon`][nodemon] to restart the server on file changes instead.
In production, this doesn't happen. The server boots up, and that's the end of it.
[rr-express]: ./adapter#react-routerexpress
[express-listen]: https://expressjs.com/en/api.html#app.listen
[rr-config]: ../framework-conventions/react-router.config.ts
[rr-serve-code]: https://github.com/remix-run/react-router/blob/main/packages/react-router-serve/cli.ts
[compression]: https://expressjs.com/en/resources/middleware/compression.html
[express-static]: https://expressjs.com/en/4x/api.html#express.static
[serve-static]: https://expressjs.com/en/resources/middleware/serve-static.html
[morgan]: https://expressjs.com/en/resources/middleware/morgan.html
[express]: https://expressjs.com
[migrate-to-express]: ./adapter#migrating-from-the-react-router-app-server
[pm2-dev]: https://npm.im/pm2-dev
[nodemon]: https://npm.im/nodemon

---

## Page 78 — `docs/api/rsc/RSCHydratedRouter.md`

Live URL: https://reactrouter.com/api/rsc/RSCHydratedRouter

# unstable_RSCHydratedRouter
[MODES: data]
<br />
<br />
<docs-warning>This API is experimental and subject to breaking changes in 
minor/patch releases. Please use with caution and pay **very** close attention 
to release notes for relevant changes.</docs-warning>
## Summary
Hydrates a server rendered [`unstable_RSCPayload`](https://api.reactrouter.com/v7/types/react-router.unstable_RSCPayload.html) in the browser.
```tsx
createFromReadableStream(getRSCStream()).then((payload) =>
  startTransition(async () => {
    hydrateRoot(
      document,
      <StrictMode>
        <RSCHydratedRouter
          createFromReadableStream={createFromReadableStream}
          payload={payload}
        />
      </StrictMode>,
      { formState: await getFormState(payload) },
    );
  }),
);
```
## Signature
```tsx
function RSCHydratedRouter({
  createFromReadableStream,
  fetch: fetchImplementation = fetch,
  payload,
  getContext,
}: RSCHydratedRouterProps)
```
## Props
### createFromReadableStream
Your `react-server-dom-xyz/client`'s `createFromReadableStream` function,
used to decode payloads from the server.
### fetch
Optional fetch implementation. Defaults to global [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/fetch).
### getContext
A function that returns an [`RouterContextProvider`](../utils/RouterContextProvider) instance
which is provided as the `context` argument to client [`action`](../../start/data/route-object#action)s,
[`loader`](../../start/data/route-object#loader)s and [middleware](../../how-to/middleware).
This function is called to generate a fresh `context` instance on each
navigation or fetcher call.
### payload
The decoded [`unstable_RSCPayload`](https://api.reactrouter.com/v7/types/react-router.unstable_RSCPayload.html) to hydrate.

---

## Page 79 — `docs/api/rsc/RSCStaticRouter.md`

Live URL: https://reactrouter.com/api/rsc/RSCStaticRouter

# unstable_RSCStaticRouter
[MODES: data]
<br />
<br />
<docs-warning>This API is experimental and subject to breaking changes in 
minor/patch releases. Please use with caution and pay **very** close attention 
to release notes for relevant changes.</docs-warning>
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.unstable_RSCStaticRouter.html)
Pre-renders an [`unstable_RSCPayload`](https://api.reactrouter.com/v7/types/react-router.unstable_RSCPayload.html) to HTML. Usually used in
[`unstable_routeRSCServerRequest`](../rsc/routeRSCServerRequest)'s `renderHTML` callback.
```tsx
routeRSCServerRequest({
  request,
  serverResponse,
  createFromReadableStream,
  async renderHTML(getPayload) {
    const payload = getPayload();
    return await renderHTMLToReadableStream(
      <RSCStaticRouter getPayload={getPayload} />,
      {
        bootstrapScriptContent,
        formState: await payload.formState,
      }
    );
  },
});
```
## Signature
```tsx
function RSCStaticRouter({ getPayload }: RSCStaticRouterProps)
```
## Props
### getPayload
A function that starts decoding of the [`unstable_RSCPayload`](https://api.reactrouter.com/v7/types/react-router.unstable_RSCPayload.html). Usually passed
through from [`unstable_routeRSCServerRequest`](../rsc/routeRSCServerRequest)'s `renderHTML`.

---

## Page 80 — `docs/api/rsc/createCallServer.md`

Live URL: https://reactrouter.com/api/rsc/createCallServer

# unstable_createCallServer
[MODES: data]
<br />
<br />
<docs-warning>This API is experimental and subject to breaking changes in 
minor/patch releases. Please use with caution and pay **very** close attention 
to release notes for relevant changes.</docs-warning>
## Summary
Create a React `callServer` implementation for React Router.
```tsx
setServerCallback(
  createCallServer({
    createFromReadableStream,
    createTemporaryReferenceSet,
    encodeReply,
  })
);
```
## Signature
```tsx
function createCallServer({
  createFromReadableStream,
  createTemporaryReferenceSet,
  encodeReply,
  fetch: fetchImplementation = fetch,
}: {
  createFromReadableStream: BrowserCreateFromReadableStreamFunction;
  createTemporaryReferenceSet: () => unknown;
  encodeReply: EncodeReplyFunction;
  fetch?: (request: Request) => Promise<Response>;
})
```
## Params
### opts.createFromReadableStream
Your `react-server-dom-xyz/client`'s `createFromReadableStream`. Used to decode payloads from the server.
### opts.createTemporaryReferenceSet
A function that creates a temporary reference set for the [RSC](https://react.dev/reference/rsc/server-components)
payload.
### opts.encodeReply
Your `react-server-dom-xyz/client`'s `encodeReply`. Used when sending payloads to the server.
### opts.fetch
Optional [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) implementation. Defaults to global [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/fetch).
## Returns
A function that can be used to call server actions.

---

## Page 81 — `docs/api/rsc/getRSCStream.md`

Live URL: https://reactrouter.com/api/rsc/getRSCStream

# unstable_getRSCStream
[MODES: data]
<br />
<br />
<docs-warning>This API is experimental and subject to breaking changes in 
minor/patch releases. Please use with caution and pay **very** close attention 
to release notes for relevant changes.</docs-warning>
## Summary
Get the prerendered [RSC](https://react.dev/reference/rsc/server-components)
stream for hydration. Usually passed directly to your
`react-server-dom-xyz/client`'s `createFromReadableStream`.
```tsx
createFromReadableStream(getRSCStream()).then(
  (payload: RSCServerPayload) => {
    startTransition(async () => {
      hydrateRoot(
        document,
        <StrictMode>
          <RSCHydratedRouter {...props} />
        </StrictMode>,
        {
          // Options
        }
      );
    });
  }
);
```
## Signature
```tsx
function getRSCStream(): ReadableStream
```
## Returns
A [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
that contains the [RSC](https://react.dev/reference/rsc/server-components)
data for hydration.

---

## Page 82 — `docs/api/rsc/index.md`

Live URL: https://reactrouter.com/api/rsc/index



---

## Page 83 — `docs/api/rsc/matchRSCServerRequest.md`

Live URL: https://reactrouter.com/api/rsc/matchRSCServerRequest

# unstable_matchRSCServerRequest
[MODES: data]
<br />
<br />
<docs-warning>This API is experimental and subject to breaking changes in 
minor/patch releases. Please use with caution and pay **very** close attention 
to release notes for relevant changes.</docs-warning>
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/variables/react-router.unstable_matchRSCServerRequest.html)
Matches the given routes to a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
and returns an [RSC](https://react.dev/reference/rsc/server-components)
[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
encoding an [`unstable_RSCPayload`](https://api.reactrouter.com/v7/types/react-router.unstable_RSCPayload.html) for consumption by an [RSC](https://react.dev/reference/rsc/server-components)
enabled client router.
```tsx
matchRSCServerRequest({
  createTemporaryReferenceSet,
  decodeAction,
  decodeFormState,
  decodeReply,
  loadServerAction,
  request,
  routes: routes(),
  generateResponse(match) {
    return new Response(
      renderToReadableStream(match.payload),
      {
        status: match.statusCode,
        headers: match.headers,
      }
    );
  },
});
```
## Signature
```tsx
async function matchRSCServerRequest({
  allowedActionOrigins,
  createTemporaryReferenceSet,
  basename,
  decodeReply,
  requestContext,
  routeDiscovery,
  loadServerAction,
  decodeAction,
  decodeFormState,
  onError,
  request,
  routes,
  generateResponse,
}: {
  allowedActionOrigins?: string[];
  createTemporaryReferenceSet: () => unknown;
  basename?: string;
  decodeReply?: DecodeReplyFunction;
  decodeAction?: DecodeActionFunction;
  decodeFormState?: DecodeFormStateFunction;
  requestContext?: RouterContextProvider;
  loadServerAction?: LoadServerActionFunction;
  onError?: (error: unknown) => void;
  request: Request;
  routes: RSCRouteConfigEntry[];
  routeDiscovery?: RouteDiscovery;
  generateResponse: (
    match: RSCMatch,
    {
      onError,
      temporaryReferences,
    }: {
      onError(error: unknown): string | undefined;
      temporaryReferences: unknown;
    },
  ) => Response;
}): Promise<Response>
```
## Params
### opts.allowedActionOrigins
Origin patterns that are allowed to execute actions.
### opts.basename
The basename to use when matching the request.
### opts.createTemporaryReferenceSet
A function that returns a temporary reference set for the request, used to track temporary references in the [RSC](https://react.dev/reference/rsc/server-components)
stream.
### opts.decodeAction
Your `react-server-dom-xyz/server`'s `decodeAction` function, responsible for loading a server action.
### opts.decodeFormState
A function responsible for decoding form state for progressively enhanceable forms with React's [`useActionState`](https://react.dev/reference/react/useActionState)
using your `react-server-dom-xyz/server`'s `decodeFormState`.
### opts.decodeReply
Your `react-server-dom-xyz/server`'s `decodeReply` function, used to decode the server function's arguments and bind them to the
implementation for invocation by the router.
### opts.generateResponse
A function responsible for using your `renderToReadableStream` to generate a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
encoding the [`unstable_RSCPayload`](https://api.reactrouter.com/v7/types/react-router.unstable_RSCPayload.html).
### opts.loadServerAction
Your `react-server-dom-xyz/server`'s `loadServerAction` function, used to load a server action by ID.
### opts.onError
An optional error handler that will be called with any errors that occur during the request processing.
### opts.request
The [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) to match against.
### opts.requestContext
An instance of [`RouterContextProvider`](../utils/RouterContextProvider) that should be created per request, to be passed to [`action`](../../start/data/route-object#action)s,
[`loader`](../../start/data/route-object#loader)s and [middleware](../../how-to/middleware).
### opts.routeDiscovery
The route discovery configuration, used to determine how the router should discover new routes during navigations.
### opts.routes
Your [route definitions](https://api.reactrouter.com/v7/types/react-router.unstable_RSCRouteConfigEntry.html).
## Returns
A [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
that contains the [RSC](https://react.dev/reference/rsc/server-components)
data for hydration.

---

## Page 84 — `docs/api/rsc/routeRSCServerRequest.md`

Live URL: https://reactrouter.com/api/rsc/routeRSCServerRequest

# unstable_routeRSCServerRequest
[MODES: data]
<br />
<br />
<docs-warning>This API is experimental and subject to breaking changes in 
minor/patch releases. Please use with caution and pay **very** close attention 
to release notes for relevant changes.</docs-warning>
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.unstable_routeRSCServerRequest.html)
Routes the incoming [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
to the [RSC](https://react.dev/reference/rsc/server-components) server and
appropriately proxies the server response for data / resource requests, or
renders to HTML for a document request.
```tsx
routeRSCServerRequest({
  request,
  serverResponse,
  createFromReadableStream,
  async renderHTML(getPayload) {
    const payload = getPayload();
    return await renderHTMLToReadableStream(
      <RSCStaticRouter getPayload={getPayload} />,
      {
        bootstrapScriptContent,
        formState: await payload.formState,
      }
    );
  },
});
```
## Signature
```tsx
async function routeRSCServerRequest({
  request,
  serverResponse,
  createFromReadableStream,
  renderHTML,
  hydrate = true,
}: {
  request: Request;
  serverResponse: Response;
  createFromReadableStream: SSRCreateFromReadableStreamFunction;
  renderHTML: (
    getPayload: () => DecodedPayload,
    options: {
      onError(error: unknown): string | undefined;
      onHeaders(headers: Headers): void;
    },
  ) => ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array>>;
  hydrate?: boolean;
}): Promise<Response>
```
## Params
### opts.createFromReadableStream
Your `react-server-dom-xyz/client`'s `createFromReadableStream` function, used to decode payloads from the server.
### opts.serverResponse
A Response or partial response generated by the [RSC](https://react.dev/reference/rsc/server-components) handler containing a serialized [`unstable_RSCPayload`](https://api.reactrouter.com/v7/types/react-router.unstable_RSCPayload.html).
### opts.hydrate
Whether to hydrate the server response with the RSC payload. Defaults to `true`.
### opts.renderHTML
A function that renders the [`unstable_RSCPayload`](https://api.reactrouter.com/v7/types/react-router.unstable_RSCPayload.html) to HTML, usually using a [`<RSCStaticRouter>`](../rsc/RSCStaticRouter).
### opts.request
The request to route.
## Returns
A [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
that either contains the [RSC](https://react.dev/reference/rsc/server-components)
payload for data requests, or renders the HTML for document requests.

---

## Page 85 — `docs/api/utils/IsCookieFunction.md`

Live URL: https://reactrouter.com/api/utils/IsCookieFunction

# IsCookieFunction
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.IsCookieFunction.html)

---

## Page 86 — `docs/api/utils/IsSessionFunction.md`

Live URL: https://reactrouter.com/api/utils/IsSessionFunction

# IsSessionFunction
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.IsSessionFunction.html)

---

## Page 87 — `docs/api/utils/RouterContextProvider.md`

Live URL: https://reactrouter.com/api/utils/RouterContextProvider

# RouterContextProvider
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/classes/react-router.RouterContextProvider.html)
Provides methods for writing/reading values in application context in a
type-safe way. Primarily for usage with [middleware](../../how-to/middleware).
```tsx
const userContext = createContext<User | null>(null);
const contextProvider = new RouterContextProvider();
contextProvider.set(userContext, getUser());
//                               ^ Type-safe
const user = contextProvider.get(userContext);
//    ^ User
```

---

## Page 88 — `docs/api/utils/createContext.md`

Live URL: https://reactrouter.com/api/utils/createContext

# createContext
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createContext.html)
Creates a type-safe [`RouterContext`](https://api.reactrouter.com/v7/interfaces/react-router.RouterContext.html) object that can be used to
store and retrieve arbitrary values in [`action`](../../start/framework/route-module#action)s,
[`loader`](../../start/framework/route-module#loader)s, and [middleware](../../how-to/middleware).
Similar to React's [`createContext`](https://react.dev/reference/react/createContext),
but specifically designed for React Router's request/response lifecycle.
If a `defaultValue` is provided, it will be returned from `context.get()`
when no value has been set for the context. Otherwise, reading this context
when no value has been set will throw an error.
```tsx filename=app/context.ts
// Create a context for user data
```
```tsx filename=app/middleware/auth.ts
  context.set(userContext, user);
};
```
```tsx filename=app/routes/profile.tsx
export async function loader({
  context,
}: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return { user };
}
```
## Signature
```tsx
function createContext<T>(defaultValue?: T): RouterContext<T>
```
## Params
### defaultValue
An optional default value for the context. This value will be returned if no value has been set for this context.
## Returns
A [`RouterContext`](https://api.reactrouter.com/v7/interfaces/react-router.RouterContext.html) object that can be used with
`context.get()` and `context.set()` in [`action`](../../start/framework/route-module#action)s,
[`loader`](../../start/framework/route-module#loader)s, and [middleware](../../how-to/middleware).

---

## Page 89 — `docs/api/utils/createCookie.md`

Live URL: https://reactrouter.com/api/utils/createCookie

# createCookie
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createCookie.html)
Creates a logical container for managing a browser cookie from the server.

---

## Page 90 — `docs/api/utils/createCookieSessionStorage.md`

Live URL: https://reactrouter.com/api/utils/createCookieSessionStorage

# createCookieSessionStorage
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createCookieSessionStorage.html)
Creates and returns a SessionStorage object that stores all session data
directly in the session cookie itself.
This has the advantage that no database or other backend services are
needed, and can help to simplify some load-balanced scenarios. However, it
also has the limitation that serialized session data may not exceed the
browser's maximum cookie size. Trade-offs!

---

## Page 91 — `docs/api/utils/createMemorySessionStorage.md`

Live URL: https://reactrouter.com/api/utils/createMemorySessionStorage

# createMemorySessionStorage
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createMemorySessionStorage.html)
Creates and returns a simple in-memory SessionStorage object, mostly useful
for testing and as a reference implementation.
Note: This storage does not scale beyond a single process, so it is not
suitable for most production scenarios.

---

## Page 92 — `docs/api/utils/createPath.md`

Live URL: https://reactrouter.com/api/utils/createPath

# createPath
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createPath.html)
Creates a string URL path from the given pathname, search, and hash components.
## Signature
```tsx
createPath(__namedParameters): string
```
## Params
### \_\_namedParameters
[modes: framework, data, declarative]
_No documentation_

---

## Page 93 — `docs/api/utils/createRequestHandler.md`

Live URL: https://reactrouter.com/api/utils/createRequestHandler

# createRequestHandler
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createRequestHandler.html)

---

## Page 94 — `docs/api/utils/createRoutesFromElements.md`

Live URL: https://reactrouter.com/api/utils/createRoutesFromElements

# createRoutesFromElements
[MODES: data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createRoutesFromElements.html)
Create route objects from JSX elements instead of arrays of objects.
```tsx
const routes = createRoutesFromElements(
  <>
    <Route index loader={step1Loader} Component={StepOne} />
    <Route path="step-2" loader={step2Loader} Component={StepTwo} />
    <Route path="step-3" loader={step3Loader} Component={StepThree} />
  </>
);
const router = createBrowserRouter(routes);
function App() {
  return <RouterProvider router={router} />;
}
```
## Params
### children
The React children to convert into a route config
### parentPath
The path of the parent route, used to generate unique IDs. This is used for internal recursion and is not intended to be used by the
application developer.
## Returns
An array of [`RouteObject`](https://api.reactrouter.com/v7/types/react-router.RouteObject.html)s that can be used with a [`DataRouter`](https://api.reactrouter.com/v7/interfaces/react-router.DataRouter.html)

---

## Page 95 — `docs/api/utils/createRoutesStub.md`

Live URL: https://reactrouter.com/api/utils/createRoutesStub

# createRoutesStub
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createRoutesStub.html)
## Signature
```tsx
createRoutesStub(routes, context): undefined
```
## Params
### routes
[modes: framework, data]
_No documentation_
### context
[modes: framework, data]
_No documentation_

---

## Page 96 — `docs/api/utils/createSearchParams.md`

Live URL: https://reactrouter.com/api/utils/createSearchParams

# createSearchParams
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createSearchParams.html)
Creates a URLSearchParams object using the given initializer.
This is identical to `new URLSearchParams(init)` except it also
supports arrays as values in the object form of the initializer
instead of just strings. This is convenient when you need multiple
values for a given key, but don't want to use an array initializer.
For example, instead of:
```tsx
let searchParams = new URLSearchParams([
  ["sort", "name"],
  ["sort", "price"],
]);
```
you can do:
```
let searchParams = createSearchParams({
  sort: ['name', 'price']
});
```
## Signature
```tsx
createSearchParams(init): URLSearchParams
```
## Params
### init
[modes: framework, data, declarative]
_No documentation_

---

## Page 97 — `docs/api/utils/createSession.md`

Live URL: https://reactrouter.com/api/utils/createSession

# createSession
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createSession.html)
Creates a new Session object.
Note: This function is typically not invoked directly by application code.
Instead, use a `SessionStorage` object's `getSession` method.

---

## Page 98 — `docs/api/utils/createSessionStorage.md`

Live URL: https://reactrouter.com/api/utils/createSessionStorage

# createSessionStorage
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.createSessionStorage.html)
Creates a SessionStorage object using a SessionIdStorageStrategy.
Note: This is a low-level API that should only be used if none of the
existing session storage options meet your requirements.

---

## Page 99 — `docs/api/utils/data.md`

Live URL: https://reactrouter.com/api/utils/data

# data
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.data.html)
Create "responses" that contain `headers`/`status` without forcing
serialization into an actual [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
```tsx
export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData();
  let item = await createItem(formData);
  return data(item, {
    headers: { "X-Custom-Header": "value" }
    status: 201,
  });
}
```
## Signature
```tsx
function data<D>(data: D, init?: number | ResponseInit)
```
## Params
### data
The data to be included in the response.
### init
The status code or a `ResponseInit` object to be included in the response.
## Returns
A `DataWithResponseInit` instance containing the data and
response init.

---

## Page 100 — `docs/api/utils/generatePath.md`

Live URL: https://reactrouter.com/api/utils/generatePath

# generatePath
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.generatePath.html)
Returns a path with params interpolated.
```tsx
generatePath("/users/:id", { id: "123" }); // "/users/123"
```
## Signature
```tsx
function generatePath<Path extends string>(
  originalPath: Path,
  params: GeneratePathParams<Path> =  as any,
): string {}
```
## Params
### originalPath
The original path to generate.
### params
The parameters to interpolate into the path.
## Returns
The generated path with parameters interpolated.

---

## Page 101 — `docs/api/utils/href.md`

Live URL: https://reactrouter.com/api/utils/href

# href
[MODES: framework]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.href.html)
Returns a resolved URL path for the specified route.
```tsx
const h = href("/:lang?/about", { lang: "en" })
// -> `/en/about`
<Link to={href("/products/:id", { id: "abc123" })} />
```

---

## Page 102 — `docs/api/utils/index.md`

Live URL: https://reactrouter.com/api/utils/index



---

## Page 103 — `docs/api/utils/isCookie.md`

Live URL: https://reactrouter.com/api/utils/isCookie

# isCookie
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.isCookie.html)
Returns true if an object is a Remix cookie container.

---

## Page 104 — `docs/api/utils/isRouteErrorResponse.md`

Live URL: https://reactrouter.com/api/utils/isRouteErrorResponse

# isRouteErrorResponse
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.isRouteErrorResponse.html)
Check if the given error is an [`ErrorResponse`](https://api.reactrouter.com/v7/types/react-router.ErrorResponse.html) generated from a 4xx/5xx
[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
thrown from an [`action`](../../start/framework/route-module#action) or
[`loader`](../../start/framework/route-module#loader) function.
```tsx
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <>
        <p>Error: `${error.status}: ${error.statusText}`</p>
        <p>{error.data}</p>
      </>
    );
  }
  return (
    <p>Error: {error instanceof Error ? error.message : "Unknown Error"}</p>
  );
}
```
## Signature
```tsx
function isRouteErrorResponse(error: any): error is ErrorResponse
```
## Params
### error
The error to check.
## Returns
`true` if the error is an [`ErrorResponse`](https://api.reactrouter.com/v7/types/react-router.ErrorResponse.html), `false` otherwise.

---

## Page 105 — `docs/api/utils/isSession.md`

Live URL: https://reactrouter.com/api/utils/isSession

# isSession
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.isSession.html)
Returns true if an object is a React Router session.

---

## Page 106 — `docs/api/utils/matchPath.md`

Live URL: https://reactrouter.com/api/utils/matchPath

# matchPath
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.matchPath.html)
Performs pattern matching on a URL pathname and returns information about
the match.
## Signature
```tsx
function matchPath<Path extends string>(
  pattern: PathPattern<Path> | Path,
  pathname: string,
): PathMatch<ParamParseKey<Path>> | null
```
## Params
### pattern
The pattern to match against the URL pathname. This can be a string or a [`PathPattern`](https://api.reactrouter.com/v7/interfaces/react-router.PathPattern.html) object. If a string is provided, it will be
treated as a pattern with `caseSensitive` set to `false` and `end` set to
`true`.
### pathname
The URL pathname to match against the pattern.
## Returns
A path match object if the pattern matches the pathname,
or `null` if it does not match.

---

## Page 107 — `docs/api/utils/matchRoutes.md`

Live URL: https://reactrouter.com/api/utils/matchRoutes

# matchRoutes
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.matchRoutes.html)
Matches the given routes to a location and returns the match data.
```tsx
let routes = [{
  path: "/",
  Component: Root,
  children: [{
    path: "dashboard",
    Component: Dashboard,
  }]
}];
matchRoutes(routes, "/dashboard"); // [rootMatch, dashboardMatch]
```
## Signature
```tsx
function matchRoutes<RouteObjectType extends RouteObject = RouteObject>(
  routes: RouteObjectType[],
  locationArg: Partial<Location> | string,
  basename = "/",
): RouteMatch<string, RouteObjectType>[] | null
```
## Params
### routes
The array of route objects to match against.
### locationArg
The location to match against, either a string path or a partial [`Location`](https://api.reactrouter.com/v7/interfaces/react-router.Location.html) object
### basename
Optional base path to strip from the location before matching. Defaults to `/`.
## Returns
An array of matched routes, or `null` if no matches were found.

---

## Page 108 — `docs/api/utils/parsePath.md`

Live URL: https://reactrouter.com/api/utils/parsePath

# parsePath
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.parsePath.html)
Parses a string URL path into its separate pathname, search, and hash components.
## Signature
```tsx
parsePath(path): Partial
```
## Params
### path
[modes: framework, data, declarative]
_No documentation_

---

## Page 109 — `docs/api/utils/redirect.md`

Live URL: https://reactrouter.com/api/utils/redirect

# redirect
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.redirect.html)
A redirect [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response).
Sets the status code and the [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
header. Defaults to [`302 Found`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302).
This utility accepts absolute URLs and can navigate to external domains, so
the application should validate any user-supplied inputs to redirects.
```tsx
export async function loader({ request }: Route.LoaderArgs) {
  if (!isLoggedIn(request))
    throw redirect("/login");
  }
  // ...
}
```
## Params
### url
The URL to redirect to.
### init
The status code or a `ResponseInit` object to be included in the response.
## Returns
A [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
object with the redirect status and [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
header.

---

## Page 110 — `docs/api/utils/redirectDocument.md`

Live URL: https://reactrouter.com/api/utils/redirectDocument

# redirectDocument
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.redirectDocument.html)
A redirect [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
that will force a document reload to the new location. Sets the status code
and the [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
header. Defaults to [`302 Found`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302).
This utility accepts absolute URLs and can navigate to external domains, so
the application should validate any user-supplied inputs to redirects.
```tsx filename=routes/logout.tsx
export async function action({ request }: Route.ActionArgs) {
  let session = await getSession(request.headers.get("Cookie"));
  return redirectDocument("/", {
    headers: { "Set-Cookie": await destroySession(session) }
  });
}
```
## Params
### url
The URL to redirect to.
### init
The status code or a `ResponseInit` object to be included in the response.
## Returns
A [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
object with the redirect status and [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
header.

---

## Page 111 — `docs/api/utils/renderMatches.md`

Live URL: https://reactrouter.com/api/utils/renderMatches

# renderMatches
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.renderMatches.html)
Renders the result of [`matchRoutes`](../utils/matchRoutes) into a React element.
## Signature
```tsx
function renderMatches(
  matches: RouteMatch[] | null,
): React.ReactElement | null
```
## Params
### matches
The array of [route matches](https://api.reactrouter.com/v7/interfaces/react-router.RouteMatch.html) to render
## Returns
A React element that renders the matched routes or `null` if no matches

---

## Page 112 — `docs/api/utils/replace.md`

Live URL: https://reactrouter.com/api/utils/replace

# replace
[MODES: framework, data]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.replace.html)
A redirect [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
that will perform a [`history.replaceState`](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)
instead of a [`history.pushState`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState)
for client-side navigation redirects. Sets the status code and the [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
header. Defaults to [`302 Found`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302).
```tsx
export async function loader() {
  return replace("/new-location");
}
```
## Params
### url
The URL to redirect to.
### init
The status code or a `ResponseInit` object to be included in the response.
## Returns
A [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
object with the redirect status and [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
header.

---

## Page 113 — `docs/api/utils/resolvePath.md`

Live URL: https://reactrouter.com/api/utils/resolvePath

# resolvePath
[MODES: framework, data, declarative]
## Summary
[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react-router.resolvePath.html)
Returns a resolved [`Path`](https://api.reactrouter.com/v7/interfaces/react-router.Path.html) object relative to the given pathname.
## Signature
```tsx
function resolvePath(to: To, fromPathname = "/"): Path
```
## Params
### to
The path to resolve, either a string or a partial [`Path`](https://api.reactrouter.com/v7/interfaces/react-router.Path.html) object.
### fromPathname
The pathname to resolve the path from. Defaults to `/`.
## Returns
A [`Path`](https://api.reactrouter.com/v7/interfaces/react-router.Path.html) object with the resolved pathname, search, and hash.

---

## Page 114 — `docs/community/api-development-strategy.md`

Live URL: https://reactrouter.com/community/api-development-strategy

# API Development Strategy
React Router is foundational to your application. We want to make sure that upgrading to new major versions is as smooth as possible while still allowing us to adjust and enhance the behavior and API as the React ecosystem advances.
Our strategy and motivations are discussed in more detail in our [Future Flags][future-flags-blog-post] blog post and our [Open Governance Model][governance].
## Future Flags
When an API changes in a breaking way, it is introduced in a future flag. This allows you to opt-in to one change a time before it becomes the default in the next major version.
- Without enabling the future flag, nothing changes about your app
- Enabling the flag changes the behavior for that feature
All current future flags are documented in the [Future Flags Guide](../upgrading/future) to help you stay up-to-date.
## Unstable Flags
Unstable flags are for features still being designed and developed and made available to our users to help us get it right.
Unstable flags are not recommended for production:
- they will change without warning and without upgrade paths
- they will have bugs
- they aren't documented
- they may be scrapped completely
When you opt-in to an unstable flag you are becoming a contributor to the project, rather than a user. We appreciate your help, but please be aware of the new role!
Because unstable flags are experimental and not guaranteed to stick around, we ship them in SemVer patch releases because they're not new _stable_/_documented_ APIs. When an unstable flag stabilizes into a Future Flag, that will be released in a SemVer minor release and will be properly documented and added to the [Future Flags Guide](../upgrading/future).
To learn about current unstable flags, keep an eye on the [CHANGELOG](../start/changelog).
### Example New Feature Flow
The decision flow for a new feature looks something like this:
<img width="400" src="https://reactrouter.com/_docs/feature-flowchart.png" alt="Flowchart of the decision process for how to introduce a new feature" />
[future-flags-blog-post]: https://remix.run/blog/future-flags
[governance]: https://github.com/remix-run/react-router/blob/main/GOVERNANCE.md#new-feature-process

---

## Page 115 — `docs/community/contributing.md`

Live URL: https://reactrouter.com/community/contributing

# Contributing to React Router
Thanks for contributing, you rock!
When it comes to open source, there are many different kinds of contributions that can be made, all of which are valuable. Here are a few guidelines that should help you as you prepare your contribution.
## Open Governance Model
Before going any further, please read the Open Governance [blog post](https://remix.run/blog/rr-governance) and [document](https://github.com/remix-run/react-router/blob/main/GOVERNANCE.md) for information on how we handle bugs/issues/feature proposals in React Router.
## Setup
Before you can contribute to the codebase, you will need to fork the repo. This will look a bit different depending on what type of contribution you are making:
- All new features, bug-fixes, or **anything that touches `react-router` code** should be branched off of and merged into the `dev` branch
- Changes that only touch documentation can be branched off of and merged into the `main` branch
The following steps will get you set up to contribute changes to this repo:
1. Fork the repo (click the <kbd>Fork</kbd> button at the top right of [this page](https://github.com/remix-run/react-router))
2. Clone your fork locally
   ```bash
   # in a terminal, cd to parent directory where you want your clone to be, then
   git clone https://github.com/<your_github_username>/react-router.git
   cd react-router
   # if you are making *any* code changes, make sure to checkout the dev branch
   git checkout dev
   ```
3. Install dependencies and build. React Router uses [pnpm](https://pnpm.io), so you should too. If you install using `npm`, unnecessary `package-lock.json` files will be generated.
## Think You Found a Bug?
Please conform to the issue template and provide a **minimal** and **runnable** reproduction. Best is a pull request with a [failing test](https://github.com/remix-run/react-router/blob/dev/integration/bug-report-test.ts). Next best is a link to [StackBlitz](https://reactrouter.com/new), CodeSandbox, or GitHub repository that illustrates the bug.
## Issue Not Getting Attention?
If you need a bug fixed and nobody is fixing it, your best bet is to provide a fix for it and make a [pull request](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request). Open source code belongs to all of us, and it's all of our responsibility to push it forward.
## Proposing New or Changed API?
⚠️ _Please do not start with a PR for a new feature._
New features need to go through the process outlined in the [Open Governance Model](https://github.com/remix-run/react-router/blob/main/GOVERNANCE.md#new-feature-process) and can be started by opening a [Proposal Discussion](https://github.com/remix-run/react-router/discussions/new?category=proposals) on GitHub. Please provide thoughtful comments and some sample code that show what you'd like to do with React Router in your app. It helps the conversation if you can show us how you're limited by the current API first before jumping to a conclusion about what needs to be changed and/or added.
We have learned by experience that small APIs are usually better, so we may be a little reluctant to add something new unless there's an obvious limitation with the current API. That being said, we are always anxious to hear about cases that we just haven't considered before, so please don't be shy! :)
## Adding an Example?
Examples can be added directly to the `main` branch. Create a branch off of your local clone of `main`. Once you've finished, create a pull request and outline your example.
## Making a Pull Request?
Pull requests need only the approval of two or more collaborators to be merged; when the PR author is a collaborator, that counts as one.
<docs-warning>When creating the PR in GitHub, make sure that you set the base to the correct branch. If you are submitting a PR that touches any code, this should be the `dev` branch. You set the base in GitHub when authoring the PR with the dropdown below the "Compare changes" heading: <img src="https://raw.githubusercontent.com/remix-run/react-router/main/static/base-branch.png" alt="" width="460" height="350" /></docs-warning>
### Tests
All commits that fix bugs or add features need one or more tests.
<docs-error>Do not merge code without tests!</docs-error>
### Change Files
In order to facilitate release notes generation, every PR with a user-facing impact should include one or more change files. You can generate these vis `pnpm run changes:add` (requires node 24+).
This tool will generate change files in the relevant `packages/<package>/.changes/` directories. Change files are markdown files with a short description of the change. They should be named using the format `<type>.<short-description>.md` where type is either `patch`, `minor`, `major`, or `unstable`. For example:
```sh
patch.fix-fetcher-redirects.md
minor.add-some-new-api.md
major.require-node-24.md
unstable.update-unstable-api.md
```
### Docs + Examples
All commits that change or add to the API must be done in a pull request that also updates all relevant examples and docs.
Documentation is located in the `docs` directory. Once changes make their way into the `main` branch, they will automatically be published to the docs site.
If you want to preview how the changes will look on the docs site, clone the [`react-router-website` repository](https://github.com/remix-run/react-router-website) and follow the instructions in `README.md` to view your changes locally.
## Development
### Packages
React Router uses a monorepo to host code for multiple packages. These packages live in the `packages` directory.
We use [pnpm workspaces](https://pnpm.io/workspaces/) to manage installation of dependencies and running various scripts. To get everything installed, make sure you have [pnpm installed](https://pnpm.io/installation), and then run `pnpm install` from the repo root.
### Building
Calling `pnpm build` from the root directory will run the build, which should take only a few seconds. It's important to build all the packages together because the individual packages have dependencies on one another.
### Testing
Before running the tests, you need to run a build. After you build, running `pnpm test` from the root directory will run **every** package's tests. If you want to run tests for a specific package, use `pnpm test packages/<package-name>/`:
```bash
# Test all packages
pnpm test
# Test only @react-router/dev
pnpm test packages/react-router-dev/
```
## Repository Branching
This repo maintains separate branches for different purposes. They will look something like this:
```
- main   > the most recent release and current docs
- dev    > code under active development between stable releases
- v6     > the most recent code for a specific major release
```
There may be other branches for various features and experimentation, but all of the magic happens from these branches.
## Releases
Please refer to [DEVELOPMENT.md](https://github.com/remix-run/react-router/blob/main/DEVELOPMENT.md) for an outline of the release process.

---

## Page 116 — `docs/community/index.md`

Live URL: https://reactrouter.com/community/index



---

## Page 117 — `docs/elements.md`

Live URL: https://reactrouter.com/elements

# Markdown Elements
This is for testing all the different kinds of markdown that can exist. Whenever I find a styling edge case that exists, I add it to this document. It’s my form of visual regression for all the different kinds of elements that need to be styled across different contexts.
## Headings
Headings at sizes 4, 5, and 6 are all treated equally. If we start writing prose that needs those headings, we should re-evaluate our lives.
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
## Tables
| Syntax | Description |
| ------ | ----------- |
| Row 1  | Column 2    |
| Row 2  | Column 2    |
| Row 3  | Column 2    |
## Callouts
Callouts can be used with the `<docs-*>` elements. They are specifically for calling special attention to pieces of information outside the normal flow of the document.
There are three supported variations of these elements:
1. `<docs-info>` - For general callouts to bits of information.
2. `<docs-warning>` - For warning the read about something they should know.
3. `<docs-error>` - For telling the user they shouldn’t be doing something.
Examples:
<docs-info>`<Link to>` with a `..` behaves differently from a normal `<a href>` when the current URL ends with `/`. `<Link to>` ignores the trailing slash, and removes one URL segment for each `..`. But an `<a href>` value handles `..` differently when the current URL ends with `/` vs when it does not.</docs-info>
<docs-warning>`useMatches` only works with a data router like [`createBrowserRouter`][createbrowserrouter], since they know the full route tree up front and can provide all of the current matches. Additionally, `useMatches` will not match down into any descendant route trees since the router isn't aware of the descendant routes.</docs-warning>
<docs-error>Do not do this</docs-error>
<docs-info>The markup for this is kind of ugly, because (currently) these all have to be inside the `<docs-*>` element without any line breaks _but_ it is possible there could be an image inside these. <img src="https://picsum.photos/480/270" width="480" height="270" /></docs-info>
Note: maybe the semantics for these aren't quite right. There might be other nouns that make sense in the case of docs, like:
- `<docs-info>` could become `<docs-tip>`
- `<docs-warning>` could become `<docs-important>`
- `<docs-error>` could become `<docs-warning>` or `<docs-danger>`
## Blockquotes
This is a `<blockquote>` with multiple lines and styles in it:
> This is my quote.
>
> It can have [links]($link), **bold text**, _italic text_, and even `<code>`, all of which should be accounted for. Oh, and don't forget lists:
>
> - List item 1
> - List item 2
> - List item 3
>
> Unordered, or ordered:
>
> 1. List item
> 2. Another list item
> 3. Yet another list item
## Lists
This is a list of links, some of which are code:
- This is my first list item
- [This is my second list item that’s a link][$link]
- This is my third item that has `<code>` and [`<LinkedCode>` mixed with text][$link]
And don't forget about proper styling for `<a>` tags that don’t have an `href`: <a>like this link right here</a>.
And then there’s the `<dl>` lists:
<dl>
  <dt>React</dt>
  <dd>Respond or behave in a particular way in response to something</dd>
  <dt>Router</dt>
  <dd>A device that forwards data packets to the appropriate parts of a computer network.</dd>
  <dt>Library</dt>
  <dd>A building or room containing collections of books, periodicals, and sometimes films and recorded music for people to read, borrow, or refer to.</dd>
  <dd>A collection of programs and software packages made generally available, often loaded and stored on disk for immediate use.</dd>
</dl>
## Code
Normal code:
```tsx
<WhateverRouter initialEntries={["/events/123"]}>
  <Route path="/" element={<Root />} loader={rootLoader}>
    <Route
      path="events/:id"
      element={<Event />}
      loader={eventLoader}
    />
  </Route>
</WhateverRouter>
```
With multiple highlighted lines:
```tsx lines=[1-2,5]
<WhateverRouter initialEntries={["/events/123"]}>
  <Route path="/" element={<Root />} loader={rootLoader}>
    <Route
      path="events/:id"
      element={<Event />}
      loader={eventLoader}
    />
  </Route>
</WhateverRouter>
```
With a filename:
```tsx filename=src/main.jsx
<WhateverRouter initialEntries={["/events/123"]}>
  <Route path="/" element={<Root />} loader={rootLoader}>
    <Route
      path="events/:id"
      element={<Event />}
      loader={eventLoader}
    />
  </Route>
</WhateverRouter>
```
Bad code:
```tsx bad
<WhateverRouter initialEntries={["/events/123"]}>
  <Route path="/" element={<Root />} loader={rootLoader}>
    <Route
      path="events/:id"
      element={<Event />}
      loader={eventLoader}
    />
  </Route>
</WhateverRouter>
```
Bad code with highlighted lines and a filename:
```tsx filename=src/main.jsx bad lines=[2-5]
<WhateverRouter initialEntries={["/events/123"]}>
  <Routes>
    <Route path="/" element={<Root />} loader={rootLoader}>
      <Route
        path="events/:id"
        element={<Event />}
        loader={eventLoader}
      />
    </Route>
  </Routes>
</WhateverRouter>
```
Lines that overflow:
```html
<script src="https://unpkg.com/react@>=16.8/umd/react.development.js" crossorigin></script>
```
---
[$link]: https://www.youtube.com/watch?v=dQw4w9WgXcQ
[createbrowserrouter]: ./routers/create-browser-router

---

## Page 118 — `docs/explanation/backend-for-frontend.md`

Live URL: https://reactrouter.com/explanation/backend-for-frontend

# Backend For Frontend
[MODES: framework]
<br/>
<br/>
While React Router can serve as your fullstack application, it also fits perfectly into the "Backend for Frontend" architecture.
The BFF strategy employs a web server with a job scoped to serving the frontend web app and connecting it to the services it needs: your database, mailer, job queues, existing backend APIs (REST, GraphQL), etc. Instead of your UI integrating directly from the browser to these services, it connects to the BFF, and the BFF connects to your services.
Mature apps already have a lot of backend application code in Ruby, Elixir, PHP, etc., and there's no reason to justify migrating it all to a server-side JavaScript runtime just to get the benefits of React Router. Instead, you can use your React Router app as a backend for your frontend.
You can use `fetch` right from your loaders and actions to your backend.
```tsx lines=[7,13,17]
export async function loader() {
  const apiUrl = "https://api.example.com/some-data.json";
  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${process.env.API_TOKEN}`,
    },
  });
  const data = await res.json();
  const prunedData = data.map((record) => {
    return {
      id: record.id,
      title: record.title,
      formattedBody: escapeHtml(record.content),
    };
  });
  return { prunedData };
}
```
There are several benefits of this approach vs. fetching directly from the browser. The highlighted lines above show how you can:
1. Simplify third-party integrations and keep tokens and secrets out of client bundles
2. Prune the data down to send less kB over the network, speeding up your app significantly
3. Move a lot of code from browser bundles to the server, like `escapeHtml`, which speeds up your app. Additionally, moving code to the server usually makes your code easier to maintain since server-side code doesn't have to worry about UI states for async operations
Again, React Router can be used as your only server by talking directly to the database and other services with server-side JavaScript APIs, but it also works perfectly as a backend for your frontend. Go ahead and keep your existing API server for application logic and let React Router connect the UI to it.

---

## Page 119 — `docs/explanation/code-splitting.md`

Live URL: https://reactrouter.com/explanation/code-splitting

# Automatic Code Splitting
[MODES: framework]
<br/>
<br/>
When using React Router's framework features, your application is automatically code split to improve the performance of initial load times when users visit your application.
## Code Splitting by Route
Consider this simple route config:
```tsx filename=app/routes.ts
export default [
  route("/contact", "./contact.tsx"),
  route("/about", "./about.tsx"),
] satisfies RouteConfig;
```
Instead of bundling all routes into a single giant build, the modules referenced (`contact.tsx` and `about.tsx`) become entry points to the bundler.
Because these entry points are coupled to URL segments, React Router knows just from a URL which bundles are needed in the browser, and more importantly, which are not.
If the user visits `"/about"` then the bundles for `about.tsx` will be loaded but not `contact.tsx`. This drastically reduces the JavaScript footprint for initial page loads and speeds up your application.
## Removal of Server Code
Any server-only [Route Module APIs][route-module] will be removed from the bundles. Consider this route module:
```tsx
export async function loader() {
  return { message: "hello" };
}
export async function action() {
  console.log(Date.now());
  return { ok: true };
}
export async function headers() {
  return { "Cache-Control": "max-age=300" };
}
export default function Component({ loaderData }) {
  return <div>{loaderData.message}</div>;
}
```
After building for the browser, only the `Component` will still be in the bundle, so you can use server-only code in the other module exports.
[route-module]: ../../start/framework/route-module

---

## Page 120 — `docs/explanation/concurrency.md`

Live URL: https://reactrouter.com/explanation/concurrency

# Network Concurrency Management
[MODES: framework, data]
<br/>
<br/>
When building web applications, managing network requests can be a daunting task. The challenges of ensuring up-to-date data and handling simultaneous requests often lead to complex logic in the application to deal with interruptions and race conditions. React Router simplifies this process by automating network management while mirroring and expanding upon the intuitive behavior of web browsers.
To help understand how React Router handles concurrency, it's important to remember that after `form` submissions, React Router will fetch fresh data from the `loader`s. This is called revalidation.
## Natural Alignment with Browser Behavior
React Router's handling of network concurrency is heavily inspired by the default behavior of web browsers when processing documents.
### Link Navigation
**Browser Behavior**: When you click on a link in a browser and then click on another before the page transition completes, the browser prioritizes the most recent `action`. It cancels the initial request, focusing solely on the latest link clicked.
**React Router Behavior**: React Router manages client-side navigation the same way. When a link is clicked within a React Router application, it initiates fetch requests for each `loader` tied to the target URL. If another navigation interrupts the initial navigation, React Router cancels the previous fetch requests, ensuring that only the latest requests proceed.
### Form Submission
**Browser Behavior**: If you initiate a form submission in a browser and then quickly submit another form again, the browser disregards the first submission, processing only the latest one.
**React Router Behavior**: React Router mimics this behavior when working with forms. If a form is submitted and another submission occurs before the first completes, React Router cancels the original fetch requests. It then waits for the latest submission to complete before triggering page revalidation again.
## Concurrent Submissions and Revalidation
While standard browsers are limited to one request at a time for navigations and form submissions, React Router elevates this behavior. Unlike navigation, with [`useFetcher`][use_fetcher] multiple requests can be in flight simultaneously.
React Router is designed to handle multiple form submissions to server `action`s and concurrent revalidation requests efficiently. It ensures that as soon as new data is available, the state is updated promptly. However, React Router also safeguards against potential pitfalls by refraining from committing stale data when other `action`s introduce race conditions.
For instance, if three form submissions are in progress, and one completes, React Router updates the UI with that data immediately without waiting for the other two so that the UI remains responsive and dynamic. As the remaining submissions finalize, React Router continues to update the UI, ensuring that the most recent data is displayed.
Using this key:
- `|`: Submission begins
- ✓: Action complete, data revalidation begins
- ✅: Revalidated data is committed to the UI
- ❌: Request cancelled
We can visualize this scenario in the following diagram:
```text
submission 1: |----✓-----✅
submission 2:    |-----✓-----✅
submission 3:             |-----✓-----✅
```
However, if a subsequent submission's revalidation completes before an earlier one, React Router discards the earlier data, ensuring that only the most up-to-date information is reflected in the UI:
```text
submission 1: |----✓---------❌
submission 2:    |-----✓-----✅
submission 3:             |-----✓-----✅
```
Because the revalidation from submission (2) started later and landed earlier than submission (1), the requests from submission (1) are canceled and only the data from submission (2) is committed to the UI. It was requested later, so it's more likely to contain the updated values from both (1) and (2).
## Potential for Stale Data
It's unlikely your users will ever experience this, but there are still chances for the user to see stale data in very rare conditions with inconsistent infrastructure. Even though React Router cancels requests for stale data, they will still end up making it to the server. Canceling a request in the browser simply releases browser resources for that request; it can't "catch up" and stop it from getting to the server. In extremely rare conditions, a canceled request may change data after the interrupting `action`'s revalidation lands. Consider this diagram:
```text
     👇 interruption with new submission
|----❌----------------------✓
       |-------✓-----✅
                             👆
                  initial request reaches the server
                  after the interrupting submission
                  has completed revalidation
```
The user is now looking at different data than what is on the server. Note that this problem is both extremely rare and exists with default browser behavior, too. The chance of the initial request reaching the server later than both the submission and revalidation of the second is unexpected on any network and server infrastructure. If this is a concern with your infrastructure, you can send timestamps with your form submissions and write server logic to ignore stale submissions.
## Example
In UI components like comboboxes, each keystroke can trigger a network request. Managing such rapid, consecutive requests can be tricky, especially when ensuring that the displayed results match the most recent query. However, with React Router, this challenge is automatically handled, ensuring that users see the correct results without developers having to micromanage the network.
```tsx filename=app/pages/city-search.tsx
export async function loader({ request }) {
  const { searchParams } = new URL(request.url);
  const cities = await searchCities(searchParams.get("q"));
  return cities;
}
export function CitySearchCombobox() {
  const fetcher = useFetcher<typeof loader>();
  return (
    <fetcher.Form action="/city-search">
      <Combobox aria-label="Cities">
        <ComboboxInput
          name="q"
          onChange={(event) =>
            // submit the form onChange to get the list of cities
            fetcher.submit(event.target.form)
          }
        />
        {/* render with the loader's data */}
        {fetcher.data ? (
          <ComboboxPopover className="shadow-popup">
            {fetcher.data.length > 0 ? (
              <ComboboxList>
                {fetcher.data.map((city) => (
                  <ComboboxOption
                    key={city.id}
                    value={city.name}
                  />
                ))}
              </ComboboxList>
            ) : (
              <span>No results found</span>
            )}
          </ComboboxPopover>
        ) : null}
      </Combobox>
    </fetcher.Form>
  );
}
```
All the application needs to know is how to query the data and how to render it. React Router handles the network.
## Conclusion
React Router offers developers an intuitive, browser-based approach to managing network requests. By mirroring browser behaviors and enhancing them where needed, it simplifies the complexities of concurrency, revalidation, and potential race conditions. Whether you're building a simple webpage or a sophisticated web application, React Router ensures that your user interactions are smooth, reliable, and always up to date.
[use_fetcher]: ../api/hooks/useFetcher

---

## Page 121 — `docs/explanation/form-vs-fetcher.md`

Live URL: https://reactrouter.com/explanation/form-vs-fetcher

# Form vs. fetcher
[MODES: framework, data]
## Overview
Developing in React Router offers a rich set of tools that can sometimes overlap in functionality, creating a sense of ambiguity for newcomers. The key to effective development in React Router is understanding the nuances and appropriate use cases for each tool. This document seeks to provide clarity on when and why to use specific APIs.
## APIs in Focus
- [`<Form>`][form-component]
- [`useFetcher`][use-fetcher]
- [`useNavigation`][use-navigation]
Understanding the distinctions and intersections of these APIs is vital for efficient and effective React Router development.
## URL Considerations
The primary criterion when choosing among these tools is whether you want the URL to change or not:
- **URL Change Desired**: When navigating or transitioning between pages, or after certain actions like creating or deleting records. This ensures that the user's browser history accurately reflects their journey through your application.
  - **Expected Behavior**: In many cases, when users hit the back button, they should be taken to the previous page. Other times the history entry may be replaced but the URL change is important nonetheless.
- **No URL Change Desired**: For actions that don't significantly change the context or primary content of the current view. This might include updating individual fields or minor data manipulations that don't warrant a new URL or page reload. This also applies to loading data with fetchers for things like popovers, combo boxes, etc.
### When the URL Should Change
These actions typically reflect significant changes to the user's context or state:
- **Creating a New Record**: After creating a new record, it's common to redirect users to a page dedicated to that new record, where they can view or further modify it.
- **Deleting a Record**: If a user is on a page dedicated to a specific record and decides to delete it, the logical next step is to redirect them to a general page, such as a list of all records.
For these cases, developers should consider using a combination of [`<Form>`][form-component] and [`useNavigation`][use-navigation]. These tools can be coordinated to handle form submission, invoke specific actions, retrieve action-related data through component props, and manage navigation respectively.
### When the URL Shouldn't Change
These actions are generally more subtle and don't require a context switch for the user:
- **Updating a Single Field**: Maybe a user wants to change the name of an item in a list or update a specific property of a record. This action is minor and doesn't necessitate a new page or URL.
- **Deleting a Record from a List**: In a list view, if a user deletes an item, they likely expect to remain on the list view, with that item no longer in the list.
- **Creating a Record in a List View**: When adding a new item to a list, it often makes sense for the user to remain in that context, seeing their new item added to the list without a full page transition.
- **Loading Data for a Popover or Combobox**: When loading data for a popover or combobox, the user's context remains unchanged. The data is loaded in the background and displayed in a small, self-contained UI element.
For such actions, [`useFetcher`][use-fetcher] is the go-to API. It's versatile, combining functionalities of these APIs, and is perfectly suited for tasks where the URL should remain unchanged.
## API Comparison
As you can see, the two sets of APIs have a lot of similarities:
| Navigation/URL API            | Fetcher API          |
| ----------------------------- | -------------------- |
| `<Form>`                      | `<fetcher.Form>`     |
| `actionData` (component prop) | `fetcher.data`       |
| `navigation.state`            | `fetcher.state`      |
| `navigation.formAction`       | `fetcher.formAction` |
| `navigation.formData`         | `fetcher.formData`   |
## Examples
### Creating a New Record
```tsx filename=app/pages/new-recipe.tsx lines=[16,23-24,29]
export async function action({
  request,
}: Route.ActionArgs) {
  const formData = await request.formData();
  const errors = await validateRecipeFormData(formData);
  if (errors) {
    return { errors };
  }
  const recipe = await db.recipes.create(formData);
  return redirect(`/recipes/${recipe.id}`);
}
export function NewRecipe({
  actionData,
}: Route.ComponentProps) {
  const { errors } = actionData || {};
  const navigation = useNavigation();
  const isSubmitting =
    navigation.formAction === "/recipes/new";
  return (
    <Form method="post">
      <label>
        Title: <input name="title" />
        {errors?.title ? <span>{errors.title}</span> : null}
      </label>
      <label>
        Ingredients: <textarea name="ingredients" />
        {errors?.ingredients ? (
          <span>{errors.ingredients}</span>
        ) : null}
      </label>
      <label>
        Directions: <textarea name="directions" />
        {errors?.directions ? (
          <span>{errors.directions}</span>
        ) : null}
      </label>
      <button type="submit">
        {isSubmitting ? "Saving..." : "Create Recipe"}
      </button>
    </Form>
  );
}
```
The example leverages [`<Form>`][form-component], component props, and [`useNavigation`][use-navigation] to facilitate an intuitive record creation process.
Using `<Form>` ensures direct and logical navigation. After creating a record, the user is naturally guided to the new recipe's unique URL, reinforcing the outcome of their action.
The component props bridge server and client, providing immediate feedback on submission issues. This quick response enables users to rectify any errors without hindrance.
Lastly, `useNavigation` dynamically reflects the form's submission state. This subtle UI change, like toggling the button's label, assures users that their actions are being processed.
Combined, these APIs offer a balanced blend of structured navigation and feedback.
### Updating a Record
Now consider we're looking at a list of recipes that have delete buttons on each item. When a user clicks the delete button, we want to delete the recipe from the database and remove it from the list without navigating away from the list.
First, consider the basic route setup to get a list of recipes on the page:
```tsx filename=app/pages/recipes.tsx
export async function loader({
  request,
}: Route.LoaderArgs) {
  return {
    recipes: await db.recipes.findAll({ limit: 30 }),
  };
}
export default function Recipes({
  loaderData,
}: Route.ComponentProps) {
  const { recipes } = loaderData;
  return (
    <ul>
      {recipes.map((recipe) => (
        <RecipeListItem key={recipe.id} recipe={recipe} />
      ))}
    </ul>
  );
}
```
Now we'll look at the action that deletes a recipe and the component that renders each recipe in the list.
```tsx filename=app/pages/recipes.tsx lines=[10,21,27]
export async function action({
  request,
}: Route.ActionArgs) {
  const formData = await request.formData();
  const id = formData.get("id");
  await db.recipes.delete(id);
  return { ok: true };
}
export default function Recipes() {
  return (
    // ...
    // doesn't matter, somewhere it's using <RecipeListItem />
  )
}
function RecipeListItem({ recipe }: { recipe: Recipe }) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== "idle";
  return (
    <li>
      <h2>{recipe.title}</h2>
      <fetcher.Form method="post">
        <input type="hidden" name="id" value={recipe.id} />
        <button disabled={isDeleting} type="submit">
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </fetcher.Form>
    </li>
  );
}
```
Using [`useFetcher`][use-fetcher] in this scenario works perfectly. Instead of navigating away or refreshing the entire page, we want in-place updates. When a user deletes a recipe, the `action` is called and the fetcher manages the corresponding state transitions.
The key advantage here is the maintenance of context. The user stays on the list when the deletion completes. The fetcher's state management capabilities are leveraged to give real-time feedback: it toggles between `"Deleting..."` and `"Delete"`, providing a clear indication of the ongoing process.
Furthermore, with each `fetcher` having the autonomy to manage its own state, operations on individual list items become independent, ensuring that actions on one item don't affect the others (though revalidation of the page data is a shared concern covered in [Network Concurrency Management][network-concurrency-management]).
In essence, `useFetcher` offers a seamless mechanism for actions that don't necessitate a change in the URL or navigation, enhancing the user experience by providing real-time feedback and context preservation.
### Mark Article as Read
Imagine you want to mark that an article has been read by the current user, after they've been on the page for a while and scrolled to the bottom. You could make a hook that looks something like this:
```tsx
function useMarkAsRead({ articleId, userId }) {
  const marker = useFetcher();
  useSpentSomeTimeHereAndScrolledToTheBottom(() => {
    marker.submit(
      { userId },
      {
        action: `/article/${articleId}/mark-as-read`,
        method: "post",
      },
    );
  });
}
```
### User Avatar Details Popup
Anytime you show the user avatar, you could put a hover effect that fetches data from a loader and displays it in a popup.
```tsx filename=app/pages/user-details.tsx
export async function loader({ params }: Route.LoaderArgs) {
  return await fakeDb.user.find({
    where: { id: params.id },
  });
}
type LoaderData = Route.ComponentProps["loaderData"];
function UserAvatar({ partialUser }) {
  const userDetails = useFetcher<LoaderData>();
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => {
    if (
      showDetails &&
      userDetails.state === "idle" &&
      !userDetails.data
    ) {
      userDetails.load(`/user-details/${partialUser.id}`);
    }
  }, [showDetails, userDetails, partialUser.id]);
  return (
    <div
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <img src={partialUser.profileImageUrl} />
      {showDetails ? (
        userDetails.state === "idle" && userDetails.data ? (
          <UserPopup user={userDetails.data} />
        ) : (
          <UserPopupLoading />
        )
      ) : null}
    </div>
  );
}
```
## Conclusion
React Router offers a range of tools to cater to varied developmental needs. While some functionalities might seem to overlap, each tool has been crafted with specific scenarios in mind. By understanding the intricacies and ideal applications of `<Form>`, `useFetcher`, and `useNavigation`, along with how data flows through component props, developers can create more intuitive, responsive, and user-friendly web applications.
[form-component]: ../api/components/Form
[use-fetcher]: ../api/hooks/useFetcher
[use-navigation]: ../api/hooks/useNavigation
[network-concurrency-management]: ./concurrency

---

## Page 122 — `docs/explanation/hot-module-replacement.md`

Live URL: https://reactrouter.com/explanation/hot-module-replacement

# Hot Module Replacement
[MODES: framework]
<br/>
<br/>
Hot Module Replacement is a technique for updating modules in your app without needing to reload the page.
It's a great developer experience, and React Router supports it when using Vite.
HMR does its best to preserve browser state across updates.
For example, let's say you have form within a modal and you fill out all the fields.
As soon as you save any changes to the code, traditional live reload would hard refresh the page causing all of those fields to be reset.
Every time you make a change, you'd have to open up the modal _again_ and fill out the form _again_.
But with HMR, all of that state is preserved _across updates_.
## React Fast Refresh
React already has mechanisms for updating the DOM via its [virtual DOM][virtual-dom] in response to user interactions like clicking a button.
Wouldn't it be great if React could handle updating the DOM in response to code changes too?
That's exactly what [React Fast Refresh][react-refresh] is all about!
Of course, React is all about components, not general JavaScript code, so React Fast Refresh only handles hot updates for exported React components.
But React Fast Refresh does have some limitations that you should be aware of.
### Class Component State
React Fast Refresh does not preserve state for class components.
This includes higher-order components that internally return classes:
```tsx
export class ComponentA extends Component {} // ❌
export const ComponentB = HOC(ComponentC); // ❌ Won't work if HOC returns a class component
export function ComponentD() {} // ✅
export const ComponentE = () => {}; // ✅
export default function ComponentF() {} // ✅
```
### Named Function Components
Function components must be named, not anonymous, for React Fast Refresh to track changes:
```tsx
export default () => {}; // ❌
export default function () {} // ❌
const ComponentA = () => {};
export default ComponentA; // ✅
export default function ComponentB() {} // ✅
```
### Supported Exports
React Fast Refresh can only handle component exports. While React Router manages [route exports like `action`, ` headers`, `links`, `loader`, and `meta`][route-module] for you, any user-defined exports will cause full reloads:
```tsx
// These exports are handled by the React Router Vite plugin
// to be HMR-compatible
export const meta = { title: "Home" }; // ✅
export const links = [
  { rel: "stylesheet", href: "style.css" },
]; // ✅
// These exports are removed by the React Router Vite plugin
// so they never affect HMR
export const headers = { "Cache-Control": "max-age=3600" }; // ✅
export const loader = async () => {}; // ✅
export const action = async () => {}; // ✅
// This is not a route module export, nor a component export,
// so it will cause a full reload for this route
export const myValue = "some value"; // ❌
export default function Route() {} // ✅
```
👆 Routes probably shouldn't be exporting random values like that anyway.
If you want to reuse values across routes, stick them in their own non-route module:
```ts filename=my-custom-value.ts
```
### Changing Hooks
React Fast Refresh cannot track changes for a component when hooks are being added or removed from it, causing full reloads just for the next render. After the hooks have been updated, changes should result in hot updates again. For example, if you add a `useState` to your component, you may lose that component's local state for the next render.
Additionally, if you are destructuring a hook's return value, React Fast Refresh will not be able to preserve state for the component if the destructured key is removed or renamed.
For example:
```tsx
export default function Component({ loaderData }) {
  const { pet } = useMyCustomHook();
  return (
    <div>
      <input />
      <p>My dog's name is {pet.name}!</p>
    </div>
  );
}
```
If you change the key `pet` to `dog`:
```diff
 export default function Component() {
-  const { pet } = useMyCustomHook();
+  const { dog } = useMyCustomHook();
   return (
     <div>
       <input />
-      <p>My dog's name is {pet.name}!</p>
+      <p>My dog's name is {dog.name}!</p>
     </div>
   );
 }
```
then React Fast Refresh will not be able to preserve state `<input />` ❌.
### Component Keys
In some cases, React cannot distinguish between existing components being changed and new components being added. [React needs `key`s][react-keys] to disambiguate these cases and track changes when sibling elements are modified.
[virtual-dom]: https://reactjs.org/docs/faq-internals.html#what-is-the-virtual-dom
[react-refresh]: https://github.com/facebook/react/tree/main/packages/react-refresh
[react-keys]: https://react.dev/learn/rendering-lists#why-does-react-need-keys
[route-module]: ../start/framework/route-module

---

## Page 123 — `docs/explanation/hydration.md`

Live URL: https://reactrouter.com/explanation/hydration

There are a few nuances worth noting around the behavior of `HydrateFallback`:
- It is only relevant on initial document request and hydration, and will not be rendered on any subsequent client-side navigations
- It is only relevant when you are also setting [`clientLoader.hydrate=true`][hydrate-true] on a given route
- It is also relevant if you do have a `clientLoader` without a server `loader`, as this implies `clientLoader.hydrate=true` since there is otherwise no loader data at all to return from `useLoaderData`
  - Even if you do not specify a `HydrateFallback` in this case, React Router will not render your route component and will bubble up to any ancestor `HydrateFallback` component
  - This is to ensure that `useLoaderData` remains "happy-path"
  - Without a server `loader`, `useLoaderData` would return `undefined` in any rendered route components
- You cannot render an `<Outlet/>` in a `HydrateFallback` because children routes can't be guaranteed to operate correctly since their ancestor loader data may not yet be available if they are running `clientLoader` functions on hydration (i.e., use cases such as `useRouteLoaderData()` or `useMatches()`)

---

## Page 124 — `docs/explanation/index-query-param.md`

Live URL: https://reactrouter.com/explanation/index-query-param

# Index Query Param
[MODES: framework, data]
## Overview
You may find a wild `?index` appearing in the URL of your app when submitting forms.
Because of nested routes, multiple routes in your route hierarchy can match the URL. Unlike navigations where all matching route [`loader`][loader]s are called to build up the UI, when a [`form`][form_element] is submitted, _only one action is called_.
Because index routes share the same URL as their parent, the `?index` param lets you disambiguate between the two.
## Understanding Index Routes
For example, consider the following route structure:
```ts filename=app/routes.ts
export default [
  route("projects", "./pages/projects.tsx", [
    index("./pages/projects/index.tsx"),
    route(":id", "./pages/projects/project.tsx"),
  ]),
] satisfies RouteConfig;
```
This creates two routes that match `/projects`:
- The parent route (`./pages/projects.tsx`)
- The index route (`./pages/projects/index.tsx`)
## Form Submission Targeting
For example, consider the following forms:
```tsx
<Form method="post" action="/projects" />
<Form method="post" action="/projects?index" />
```
The `?index` param will submit to the index route; the action without the index param will submit to the parent route.
When a [`<Form>`][form_component] is rendered in an index route without an [`action`][action], the `?index` param will automatically be appended so that the form posts to the index route. The following form, when submitted, will post to `/projects?index` because it is rendered in the context of the `projects` index route:
```tsx filename=app/pages/projects/index.tsx
function ProjectsIndex() {
  return <Form method="post" />;
}
```
If you moved the code to the project layout (`./pages/projects.tsx` in this example), it would instead post to `/projects`.
This applies to `<Form>` and all of its cousins:
```tsx
function Component() {
  const submit = useSubmit();
  submit({}, { action: "/projects" });
  submit({}, { action: "/projects?index" });
}
```
```tsx
function Component() {
  const fetcher = useFetcher();
  fetcher.submit({}, { action: "/projects" });
  fetcher.submit({}, { action: "/projects?index" });
  <fetcher.Form action="/projects" />;
  <fetcher.Form action="/projects?index" />;
  <fetcher.Form />; // defaults to the route in context
}
```
[loader]: ../api/data-routers/loader
[form_element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form
[form_component]: ../api/components/Form
[action]: ../api/data-routers/action

---

## Page 125 — `docs/explanation/index.md`

Live URL: https://reactrouter.com/explanation/index



---

## Page 126 — `docs/explanation/lazy-route-discovery.md`

Live URL: https://reactrouter.com/explanation/lazy-route-discovery

# Lazy Route Discovery
[MODES: framework]
<br/>
<br/>
Lazy Route Discovery is a performance optimization that loads route information progressively as users navigate through your application, rather than loading the complete route manifest upfront.
With Lazy Route Discovery enabled (the default), React Router sends only the routes needed for the initial server-side render in the manifest. As users navigate to new parts of your application, additional route information is fetched dynamically and added to the client-side manifest.
The route manifest contains metadata about your routes (JavaScript/CSS imports, whether routes have `loaders`/`actions`, etc.) but not the actual route module implementations. This allows React Router to understand your application's structure without downloading unnecessary route information.
## Route Discovery Process
When a user navigates to a new route that isn't in the current manifest:
1. **Route Discovery Request** - React Router makes a request to the internal `/__manifest` endpoint
2. **Manifest Patch** - The server responds with the required route information
3. **Route Loading** - React Router loads the necessary route modules and data
4. **Navigation** - The user navigates to the new route
## Eager Discovery Optimization
To prevent navigation waterfalls, React Router implements eager route discovery. All [`<Link>`](../api/components/Link) and [`<NavLink>`](../api/components/NavLink) components rendered on the current page are automatically discovered via a batched request to the server.
This discovery request typically completes before users click any links, making subsequent navigation feel synchronous even with lazy route discovery enabled.
```tsx
// Links are automatically discovered by default
<Link to="/dashboard">Dashboard</Link>
// Opt out of discovery for specific links
<Link to="/admin" discover="none">Admin</Link>
```
## Performance Benefits
Lazy Route Discovery provides several performance improvements:
- **Faster Initial Load** - Smaller initial bundle size by excluding unused route metadata
- **Reduced Memory Usage** - Route information is loaded only when needed
- **Scalability** - Applications with hundreds of routes see more significant benefits
## Configuration
You can configure route discovery behavior in your `react-router.config.ts`:
```tsx filename=react-router.config.ts
export default {
  // Default: lazy discovery with /__manifest endpoint
  routeDiscovery: {
    mode: "lazy",
    manifestPath: "/__manifest",
  },
  // Custom manifest path (useful for multiple apps on same domain)
  routeDiscovery: {
    mode: "lazy",
    manifestPath: "/my-app-manifest",
  },
  // Disable lazy discovery (include all routes initially)
  routeDiscovery: { mode: "initial" },
} satisfies Config;
```
## Deployment Considerations
When using lazy route discovery, ensure your deployment setup handles manifest requests properly:
- **Route Handling** - Ensure `/__manifest` requests reach your React Router handler
- **CDN Caching** - If using CDN/edge caching, include `version` and `paths` query parameters in your cache key for the manifest endpoint
- **Multiple Applications** - Use a custom `manifestPath` if running multiple React Router applications on the same domain

---

## Page 127 — `docs/explanation/location.md`

Live URL: https://reactrouter.com/explanation/location



---

## Page 128 — `docs/explanation/progressive-enhancement.md`

Live URL: https://reactrouter.com/explanation/progressive-enhancement

# Progressive Enhancement
[MODES: framework]
<br/>
<br/>
> Progressive enhancement is a strategy in web design that puts emphasis on web content first, allowing everyone to access the basic content and functionality of a web page, whilst users with additional browser features or faster Internet access receive the enhanced version instead.
>
> <cite>- [Wikipedia][wikipedia]</cite>
When using React Router with Server-Side Rendering (the default in framework mode), you can automatically leverage the benefits of progressive enhancement.
## Why Progressive Enhancement Matters
Coined in 2003 by Steven Champeon & Nick Finck, the phrase emerged during a time of varied CSS and JavaScript support across different browsers, with many users actually browsing the web with JavaScript disabled.
Today, we are fortunate to develop for a much more consistent web and where the majority of users have JavaScript enabled.
However, we still believe in the core principles of progressive enhancement in React Router. It leads to fast and resilient apps with simple development workflows.
**Performance**: While it's easy to think that only 5% of your users have slow connections, the reality is that 100% of your users have slow connections 5% of the time.
**Resilience**: Everybody has JavaScript disabled until it's loaded.
**Simplicity**: Building your apps in a progressively enhanced way with React Router is actually simpler than building a traditional SPA.
## Performance
Server rendering allows your app to do more things in parallel than a typical [Single Page App (SPA)][spa], making the initial loading experience and subsequent navigations faster.
Typical SPAs send a blank document and only start doing work when JavaScript has loaded:
```
HTML        |---|
JavaScript      |---------|
Data                      |---------------|
                            page rendered 👆
```
A React Router app can start doing work the moment the request hits the server and stream the response so that the browser can start downloading JavaScript, other assets, and data in parallel:
```
               👇 first byte
HTML        |---|-----------|
JavaScript      |---------|
Data        |---------------|
              page rendered 👆
```
## Resilience and Accessibility
While your users probably don't browse the web with JavaScript disabled, everybody uses the websites without JavaScript before it finishes loading. React Router embraces progressive enhancement by building on top of HTML, allowing you to build your app in a way that works without JavaScript, and then layer on JavaScript to enhance the experience.
The simplest case is a `<Link to="/account">`. These render an `<a href="/account">` tag that works without JavaScript. When JavaScript loads, React Router will intercept clicks and handle the navigation with client side routing. This gives you more control over the UX instead of just spinning favicons in the browser tab--but it works either way.
Now consider a simple add to cart button:
```tsx
export function AddToCart({ id }) {
  return (
    <Form method="post" action="/add-to-cart">
      <input type="hidden" name="id" value={id} />
      <button type="submit">Add To Cart</button>
    </Form>
  );
}
```
Whether JavaScript has loaded or not doesn't matter, this button will add the product to the cart.
When JavaScript loads, React Router will intercept the form submission and handle it client side. This allows you to add your own pending UI, or other client side behavior.
## Simplicity
When you start to rely on basic features of the web like HTML and URLs, you will find that you reach for client side state and state management much less.
Consider the button from before, with no fundamental change to the code, we can pepper in some client side behavior:
```tsx lines=[1,4,7,10-12,14]
export function AddToCart({ id }) {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post" action="/add-to-cart">
      <input name="id" value={id} />
      <button type="submit">
        {fetcher.state === "submitting"
          ? "Adding..."
          : "Add To Cart"}
      </button>
    </fetcher.Form>
  );
}
```
This feature continues to work the very same as it did before when JavaScript is loading, but once JavaScript loads:
- `useFetcher` no longer causes a navigation like `<Form>` does, so the user can stay on the same page and keep shopping
- The app code determines the pending UI instead of spinning favicons in the browser
It's not about building it two different ways–once for JavaScript and once without–it's about building it in iterations. Start with the simplest version of the feature and ship it; then iterate to an enhanced user experience.
Not only will the user get a progressively enhanced experience, but the app developer gets to "progressively enhance" the UI without changing the fundamental design of the feature.
Another example where progressive enhancement leads to simplicity is with the URL. When you start with a URL, you don't need to worry about client side state management. You can just use the URL as the source of truth for the UI.
```tsx
export function SearchBox() {
  return (
    <Form method="get" action="/search">
      <input type="search" name="query" />
      <SearchIcon />
    </Form>
  );
}
```
This component doesn't need any state management. It just renders a form that submits to `/search`. When JavaScript loads, React Router will intercept the form submission and handle it client side. Here's the next iteration:
```tsx lines=[1,4-6,11]
export function SearchBox() {
  const navigation = useNavigation();
  const isSearching =
    navigation.location.pathname === "/search";
  return (
    <Form method="get" action="/search">
      <input type="search" name="query" />
      {isSearching ? <Spinner /> : <SearchIcon />}
    </Form>
  );
}
```
No fundamental change in architecture, simply a progressive enhancement for both the user and the code.
See also: [State Management][state_management]
[wikipedia]: https://en.wikipedia.org/wiki/Progressive_enhancement
[spa]: ../how-to/spa
[state_management]: ./state-management

---

## Page 129 — `docs/explanation/race-conditions.md`

Live URL: https://reactrouter.com/explanation/race-conditions

# Race Conditions
[MODES: framework, data]
<br/>
<br/>
While impossible to eliminate every possible race condition in your application, React Router automatically handles the most common race conditions found in web user interfaces.
## Browser Behavior
React Router's handling of network concurrency is heavily inspired by the behavior of web browsers when processing documents.
Consider clicking a link to a new document, and then clicking a different link before the new page has finished loading. The browser will:
1. cancel the first request
2. immediately process the new navigation
The same behavior applies to form submissions. When a pending form submission is interrupted by a new one, the first is canceled and the new submission is immediately processed.
## React Router Behavior
Like the browser, interrupted navigations with links and form submissions will cancel in flight data requests and immediately process the new event.
Fetchers are a bit more nuanced since they are not singleton events like navigation. Fetchers can't interrupt other fetcher instances, but they can interrupt themselves and the behavior is the same as everything else: cancel the interrupted request and immediately process the new one.
Fetchers do, however, interact with each other when it comes to revalidation. After a fetcher's action request returns to the browser, a revalidation for all page data is sent. This means multiple revalidation requests can be in-flight at the same time. React Router will commit all "fresh" revalidation responses and cancel any stale requests. A stale request is any request that started _earlier_ than one that has returned.
This management of the network prevents the most common UI bugs caused by network race conditions.
Since networks are unpredictable, and your server still processes these cancelled requests, your backend may still experience race conditions and have potential data integrity issues. These risks are the same risks as using default browser behavior with plain HTML `<forms>`, which we consider to be low, and outside the scope of React Router.
## Practical Benefits
Consider building a type-ahead combobox. As the user types, you send a request to the server. As they type each new character you send a new request. It's important to not show the user results for a value that's not in the text field anymore.
When using a fetcher, this is automatically managed for you. Consider this pseudo-code:
```tsx
// route("/city-search", "./search-cities.ts")
export async function loader({ request }) {
  const { searchParams } = new URL(request.url);
  return searchCities(searchParams.get("q"));
}
```
```tsx
export function CitySearchCombobox() {
  const fetcher = useFetcher();
  return (
    <fetcher.Form action="/city-search">
      <Combobox aria-label="Cities">
        <ComboboxInput
          name="q"
          onChange={(event) =>
            // submit the form onChange to get the list of cities
            fetcher.submit(event.target.form)
          }
        />
        {fetcher.data ? (
          <ComboboxPopover className="shadow-popup">
            {fetcher.data.length > 0 ? (
              <ComboboxList>
                {fetcher.data.map((city) => (
                  <ComboboxOption
                    key={city.id}
                    value={city.name}
                  />
                ))}
              </ComboboxList>
            ) : (
              <span>No results found</span>
            )}
          </ComboboxPopover>
        ) : null}
      </Combobox>
    </fetcher.Form>
  );
}
```
Calls to `fetcher.submit` will cancel pending requests on that fetcher automatically. This ensures you never show the user results for a request for a different input value.

---

## Page 130 — `docs/explanation/react-transitions.md`

Live URL: https://reactrouter.com/explanation/react-transitions

# React Transitions
[MODES: framework, data, declarative]
<br/>
<br/>
[React 18][react-18] introduced the concept of "transitions" which allow you to differentiate urgent from non-urgent UI updates. To learn more about React Transitions and "concurrent rendering" Please refer to React's official documentation:
- [What is Concurrent React][concurrent]
- [Transitions][transitions]
- [`React.useTransition`][use-transition]
- [`React.startTransition`][start-transition]
[React 19][react-19] enhances the async/concurrent landscape by introducing [Actions][actions] and support for using async functions in Transitions. With the support for async Transitions, a new [`React.useOptimistic`][use-optimistic-blog] [hook][use-optimistic] was also introduced that allows you to surface state updates during a Transition to show users instant feedback.
## Transitions in React Router
The introduction of Transitions in React makes the story of how React Router manages your navigations and router state a bit more complicated. These are powerful APIs but they don't come without some nuance and added complexity. We aim to make React Router work seamlessly with the new React features, but in some cases there may exist some tension between the new React ways to do things and some patterns you are already using in your React Router apps (i.e., pending states, optimistic UI).
To ensure a smooth adoption story, we've introduced changes related to Transitions behind an opt-in `useTransitions` flag so that you can upgrade in a non-breaking fashion.
### Current Behavior
We first leveraged `React.startTransition` to make React Router more Suspense-friendly in React Router [6.13.0][rr-6-13-0] via the `future.v7_startTransition` flag. In v7, that became the default behavior and all router state updates are currently wrapped in `React.startTransition`.
This default behavior has 2 potential issues that `useTransitions` is designed to solve:
- There are some valid use cases where you _don't_ want your updates wrapped in `startTransition`
  - One specific issue is that `React.useSyncExternalStore` updates can't be Transitions ([^1][uses-transition-issue], [^2][uses-transition-tweet]). `useSyncExternalStore` forces a sync update, which means fallbacks can be shown in update transitions that would otherwise avoid showing the fallback.
  - React Router has a `flushSync` option on navigations to use [`React.flushSync`][flush-sync] for state updates instead, but that's not always a proper solution
- React 19 has added a new `startTransition(() => Promise))` API as well as a new `useOptimistic` hook to surface updates during Transitions
  - Without some updates to React Router, `startTransition(() => navigate(path))` doesn't work as you might expect, because we are not using `useOptimistic` internally so router state updates don't surface during the navigation, which breaks hooks like `useNavigation`
To provide a solution to both of the above issues, we're introducing a new `useTransitions` prop to the router components that will let you opt-out of using `startTransition` for router state updates (solving the first issue), or opt-into a more enhanced usage of `startTransition` + `useOptimistic` (solving the second issue). Because the current behavior is a bit incomplete with the new React 19 APIs, we plan to make the opt-in behavior the default in React Router v8, but we will likely retain the opt-out flag for use cases such as `useSyncExternalStore`.
### Opt-out via `useTransitions=false`
If your application is not "Transition-friendly" due to the usage of `useSyncExternalStore` (or other reasons), then you can opt-out via the prop:
```tsx
// Framework Mode (entry.client.tsx)
<HydratedRouter useTransitions={false} />
// Data Mode
<RouterProvider useTransitions={false} />
// Declarative Mode
<BrowserRouter useTransitions={false} />
```
This will stop the router from wrapping internal state updates in `startTransition`.
### Opt-in via `useTransitions=true`
<docs-info>Opting into this feature in Framework or Data Mode requires that you are using React 19 because it needs access to [`React.useOptimistic`][use-optimistic]</docs-info>
If you want to make your application play nicely with all of the new React 19 features that rely on concurrent mode and Transitions, then you can opt-in via the new prop:
```tsx
// Framework Mode (entry.client.tsx)
<HydratedRouter useTransitions />
// Data Mode
<RouterProvider useTransitions />
// Declarative Mode
<BrowserRouter useTransitions />
```
With this flag enabled:
- All internal state updates are wrapped in `React.startTransition` (current behavior without the flag)
- All `<Link>`/`<Form>` navigations will be wrapped in `React.startTransition`, using the promise returned by `useNavigate`/`useSubmit` so that the Transition lasts for the duration of the navigation
  - `useNavigate`/`useSubmit` do not automatically wrap in `React.startTransition`, so you can opt-out of a Transition-enabled navigation by using those directly
- In Framework/Data modes, a subset of the router state updates during a navigation will be surfaced to the UI via `useOptimistic`
  - State related to the _ongoing_ navigation and all fetcher information will be surfaced:
    - `state.navigation` for `useNavigation()`
    - `state.revalidation` for `useRevalidator()`
    - `state.actionData` for `useActionData()`
    - `state.fetchers` for `useFetcher()` and `useFetchers()`
  - State related to the _current_ location will not be surfaced:
    - `state.location` for `useLocation`
    - `state.matches` for `useMatches()`,
    - `state.loaderData` for `useLoaderData()`
    - `state.errors` for `useRouteError()`
    - etc.
Enabling this flag means that you can now have fully-Transition-enabled navigations that play nicely with any other ongoing Transition-enabled aspects of your application.
The only APIs that are automatically wrapped in an async Transition are `<Link>` and `<Form>`. For everything else, you need to wrap the operation in `startTransition` yourself.
```tsx
// Automatically Transition-enabled
<Link to="/path" />
<Form method="post" action="/path" />
// Manually Transition-enabled
startTransition(() => navigate("/path"));
startTransition(() => submit(data, { method: 'post', action: "/path" }));
startTransition(() => fetcher.load("/path"));
startTransition(() => fetcher.submit(data, { method: "post", action: "/path" }));
// Not Transition-enabled
navigate("/path");
submit(data, { method: 'post', action: "/path" });
fetcher.load("/path");
fetcher.submit(data, { method: "post", action: "/path" });
```
**Important:** You must always `return` or `await` the `navigate` promise inside `startTransition` so that the Transition encompasses the full duration of the navigation. If you forget to `return` or `await` the promise, the Transition will end prematurely and things won't work as expected.
```tsx
// ✅ Returned promise
startTransition(() => navigate("/path"));
startTransition(() => {
  setOptimistic(something);
  return navigate("/path"));
});
// ✅ Awaited promise
startTransition(async () => {
  setOptimistic(something);
  await navigate("/path"));
});
// ❌ Non-returned promise
startTransition(() => {
  setOptimistic(something);
  navigate("/path"));
});
// ❌ Non-Awaited promise
startTransition(async () => {
  setOptimistic(something);
  navigate("/path"));
});
```
#### `popstate` navigations
There is currently a bug with optimistic states and `popstate`. If you need to read the current route during a back navigation, which cannot complete synchronously (e.g. Suspends on uncached data), you can set the optimistic state before navigating back or defer the optimistic update in a timer or microtask.
[react-18]: https://react.dev/blog/2022/03/29/react-v18
[concurrent]: https://react.dev/blog/2022/03/29/react-v18#what-is-concurrent-react
[transitions]: https://react.dev/blog/2022/03/29/react-v18#new-feature-transitions
[use-transition]: https://react.dev/reference/react/useTransition#reference
[start-transition]: https://react.dev/reference/react/startTransition
[react-19]: https://react.dev/blog/2024/12/05/react-19
[actions]: https://react.dev/blog/2024/12/05/react-19#actions
[use-optimistic-blog]: https://react.dev/blog/2024/12/05/react-19#new-hook-optimistic-updates
[use-optimistic]: https://react.dev/reference/react/useOptimistic
[flush-sync]: https://react.dev/reference/react-dom/flushSync
[rr-6-13-0]: https://github.com/remix-run/react-router/blob/main/CHANGELOG.md#v6130
[uses-transition-issue]: https://github.com/facebook/react/issues/26382
[uses-transition-tweet]: https://x.com/rickhanlonii/status/1683636856808775682

---

## Page 131 — `docs/explanation/route-matching.md`

Live URL: https://reactrouter.com/explanation/route-matching

# Route Matching

---

## Page 132 — `docs/explanation/server-client-execution.md`

Live URL: https://reactrouter.com/explanation/server-client-execution



---

## Page 133 — `docs/explanation/sessions-and-cookies.md`

Live URL: https://reactrouter.com/explanation/sessions-and-cookies

# Sessions and Cookies
[MODES: framework, data]
## Sessions
Sessions are an important part of websites that allow the server to identify requests coming from the same person, especially when it comes to server-side form validation or when JavaScript is not on the page. Sessions are a fundamental building block of many sites that let users "log in", including social, e-commerce, business, and educational websites.
When using React Router as your framework, sessions are managed on a per-route basis (rather than something like express middleware) in your `loader` and `action` methods using a "session storage" object (that implements the [`SessionStorage`][session-storage] interface). Session storage understands how to parse and generate cookies, and how to store session data in a database or filesystem.
### Using Sessions
This is an example of a cookie session storage:
```ts filename=app/sessions.server.ts
type SessionData = {
  userId: string;
};
type SessionFlashData = {
  error: string;
};
const { getSession, commitSession, destroySession } =
  createCookieSessionStorage<SessionData, SessionFlashData>(
    {
      // a Cookie from `createCookie` or the CookieOptions to create one
      cookie: {
        name: "__session",
        // all of these are optional
        domain: "reactrouter.com",
        // Expires can also be set (although maxAge overrides it when used in combination).
        // Note that this method is NOT recommended as `new Date` creates only one date on each server deployment, not a dynamic date in the future!
        //
        // expires: new Date(Date.now() + 60_000),
        httpOnly: true,
        maxAge: 60,
        path: "/",
        sameSite: "lax",
        secrets: ["s3cret1"],
        secure: true,
      },
    },
  );
export { getSession, commitSession, destroySession };
```
We recommend setting up your session storage object in `app/sessions.server.ts` so all routes that need to access session data can import from the same spot.
The input/output to a session storage object are HTTP cookies. `getSession()` retrieves the current session from the incoming request's `Cookie` header, and `commitSession()`/`destroySession()` provide the `Set-Cookie` header for the outgoing response.
You'll use methods to get access to sessions in your `loader` and `action` functions.
After retrieving a session with `getSession`, the returned session object has a handful of methods and properties:
```tsx
export async function action({
  request,
}: ActionFunctionArgs) {
  const session = await getSession(
    request.headers.get("Cookie"),
  );
  session.get("foo");
  session.has("bar");
  // etc.
}
```
See the [Session API][session-api] for all methods available on the session object.
### Login form example
A login form might look something like this:
```tsx filename=app/routes/login.tsx lines=[4-7,12-14,16,22,25,33-35,46,51,56,61]
export async function loader({
  request,
}: Route.LoaderArgs) {
  const session = await getSession(
    request.headers.get("Cookie"),
  );
  if (session.has("userId")) {
    // Redirect to the home page if they are already signed in.
    return redirect("/");
  }
  return data(
    { error: session.get("error") },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    },
  );
}
export async function action({
  request,
}: Route.ActionArgs) {
  const session = await getSession(
    request.headers.get("Cookie"),
  );
  const form = await request.formData();
  const username = form.get("username");
  const password = form.get("password");
  const userId = await validateCredentials(
    username,
    password,
  );
  if (userId == null) {
    session.flash("error", "Invalid username/password");
    // Redirect back to the login page with errors.
    return redirect("/login", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }
  session.set("userId", userId);
  // Login succeeded, send them to the home page.
  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
export default function Login({
  loaderData,
}: Route.ComponentProps) {
  const { error } = loaderData;
  return (
    <div>
      {error ? <div className="error">{error}</div> : null}
      <form method="POST">
        <div>
          <p>Please sign in</p>
        </div>
        <label>
          Username: <input type="text" name="username" />
        </label>
        <label>
          Password:{" "}
          <input type="password" name="password" />
        </label>
      </form>
    </div>
  );
}
```
And then a logout form might look something like this:
```tsx filename=app/routes/logout.tsx
export async function action({
  request,
}: Route.ActionArgs) {
  const session = await getSession(
    request.headers.get("Cookie"),
  );
  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}
export default function LogoutRoute() {
  return (
    <>
      <p>Are you sure you want to log out?</p>
      <Form method="post">
        <button>Logout</button>
      </Form>
      <Link to="/">Never mind</Link>
    </>
  );
}
```
<docs-warning>It's important that you logout (or perform any mutation for that matter) in an `action` and not a `loader`. Otherwise you open your users to [Cross-Site Request Forgery][csrf] attacks.</docs-warning>
### Session Gotchas
Because of nested routes, multiple loaders can be called to construct a single page. When using `session.flash()` or `session.unset()`, you need to be sure no other loaders in the request are going to want to read that, otherwise you'll get race conditions. Typically if you're using flash, you'll want to have a single loader read it, if another loader wants a flash message, use a different key for that loader.
### Creating custom session storage
React Router makes it easy to store sessions in your own database if needed. The [`createSessionStorage()`][create-session-storage] API requires a `cookie` (for options for creating a cookie, see [cookies][cookies]) and a set of create, read, update, and delete (CRUD) methods for managing the session data. The cookie is used to persist the session ID.
- `createData` will be called from `commitSession` on the initial session creation when no session ID exists in the cookie
- `readData` will be called from `getSession` when a session ID exists in the cookie
- `updateData` will be called from `commitSession` when a session ID already exists in the cookie
- `deleteData` is called from `destroySession`
The following example shows how you could do this using a generic database client:
```ts
function createDatabaseSessionStorage({
  cookie,
  host,
  port,
}) {
  // Configure your database client...
  const db = createDatabaseClient(host, port);
  return createSessionStorage({
    cookie,
    async createData(data, expires) {
      // `expires` is a Date after which the data should be considered
      // invalid. You could use it to invalidate the data somehow or
      // automatically purge this record from your database.
      const id = await db.insert(data);
      return id;
    },
    async readData(id) {
      return (await db.select(id)) || null;
    },
    async updateData(id, data, expires) {
      await db.update(id, data);
    },
    async deleteData(id) {
      await db.delete(id);
    },
  });
}
```
And then you can use it like this:
```ts
const { getSession, commitSession, destroySession } =
  createDatabaseSessionStorage({
    host: "localhost",
    port: 1234,
    cookie: {
      name: "__session",
      sameSite: "lax",
    },
  });
```
The `expires` argument to `createData` and `updateData` is the same `Date` at which the cookie itself expires and is no longer valid. You can use this information to automatically purge the session record from your database to save on space, or to ensure that you do not otherwise return any data for old, expired cookies.
### Additional session utils
There are also several other session utilities available if you need them:
- [`isSession`][is-session]
- [`createMemorySessionStorage`][create-memory-session-storage]
- [`createSession`][create-session] (custom storage)
- [`createFileSessionStorage`][create-file-session-storage] (node)
- [`createWorkersKVSessionStorage`][create-workers-kv-session-storage] (Cloudflare Workers)
- [`createArcTableSessionStorage`][create-arc-table-session-storage] (architect, Amazon DynamoDB)
## Cookies
A [cookie][cookie] is a small piece of information that your server sends someone in a HTTP response that their browser will send back on subsequent requests. This technique is a fundamental building block of many interactive websites that adds state so you can build authentication (see [sessions][sessions]), shopping carts, user preferences, and many other features that require remembering who is "logged in".
React Router's [`Cookie` interface][cookie-api] provides a logical, reusable container for cookie metadata.
### Using cookies
While you may create these cookies manually, it is more common to use a [session storage][sessions].
In React Router, you will typically work with cookies in your `loader` and/or `action` functions, since those are the places where you need to read and write data.
Let's say you have a banner on your e-commerce site that prompts users to check out the items you currently have on sale. The banner spans the top of your homepage, and includes a button on the side that allows the user to dismiss the banner so they don't see it for at least another week.
First, create a cookie:
```ts filename=app/cookies.server.ts
```
Then, you can `import` the cookie and use it in your `loader` and/or `action`. The `loader` in this case just checks the value of the user preference so you can use it in your component for deciding whether to render the banner. When the button is clicked, the `<form>` calls the `action` on the server and reloads the page without the banner.
### User preferences example
```tsx filename=app/routes/home.tsx lines=[4,9-11,18-20,29]
export async function loader({
  request,
}: Route.LoaderArgs) {
  const cookieHeader = request.headers.get("Cookie");
  const cookie =
    (await userPrefs.parse(cookieHeader)) || {};
  return { showBanner: cookie.showBanner };
}
export async function action({
  request,
}: Route.ActionArgs) {
  const cookieHeader = request.headers.get("Cookie");
  const cookie =
    (await userPrefs.parse(cookieHeader)) || {};
  const bodyParams = await request.formData();
  if (bodyParams.get("bannerVisibility") === "hidden") {
    cookie.showBanner = false;
  }
  return redirect("/", {
    headers: {
      "Set-Cookie": await userPrefs.serialize(cookie),
    },
  });
}
export default function Home({
  loaderData,
}: Route.ComponentProps) {
  return (
    <div>
      {loaderData.showBanner ? (
        <div>
          <Link to="/sale">Don't miss our sale!</Link>
          <Form method="post">
            <input
              type="hidden"
              name="bannerVisibility"
              value="hidden"
            />
            <button type="submit">Hide</button>
          </Form>
        </div>
      ) : null}
      <h1>Welcome!</h1>
    </div>
  );
}
```
### Cookie attributes
Cookies have [several attributes][cookie-attrs] that control when they expire, how they are accessed, and where they are sent. Any of these attributes may be specified either in `createCookie(name, options)`, or during `serialize()` when the `Set-Cookie` header is generated.
```ts
const cookie = createCookie("user-prefs", {
  // These are defaults for this cookie.
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: true,
  expires: new Date(Date.now() + 60_000),
  maxAge: 60,
});
// You can either use the defaults:
cookie.serialize(userPrefs);
// Or override individual ones as needed:
cookie.serialize(userPrefs, { sameSite: "strict" });
```
Please read [more info about these attributes][cookie-attrs] to get a better understanding of what they do.
### Signing cookies
It is possible to sign a cookie to automatically verify its contents when it is received. Since it's relatively easy to spoof HTTP headers, this is a good idea for any information that you do not want someone to be able to fake, like authentication information (see [sessions][sessions]).
To sign a cookie, provide one or more `secrets` when you first create the cookie:
```ts
const cookie = createCookie("user-prefs", {
  secrets: ["s3cret1"],
});
```
Cookies that have one or more `secrets` will be stored and verified in a way that ensures the cookie's integrity.
Secrets may be rotated by adding new secrets to the front of the `secrets` array. Cookies that have been signed with old secrets will still be decoded successfully in `cookie.parse()`, and the newest secret (the first one in the array) will always be used to sign outgoing cookies created in `cookie.serialize()`.
```ts filename=app/cookies.server.ts
```
```tsx filename=app/routes/my-route.tsx
export async function loader({
  request,
}: Route.LoaderArgs) {
  const oldCookie = request.headers.get("Cookie");
  // oldCookie may have been signed with "olds3cret", but still parses ok
  const value = await cookie.parse(oldCookie);
  return data("...", {
    headers: {
      // Set-Cookie is signed with "n3wsecr3t"
      "Set-Cookie": await cookie.serialize(value),
    },
  });
}
```
### Additional cookie utils
There are also several other cookie utilities available if you need them:
- [`isCookie`][is-cookie]
- [`createCookie`][create-cookie]
To learn more about each attribute, please see the [MDN Set-Cookie docs][cookie-attrs].
[csrf]: https://developer.mozilla.org/en-US/docs/Glossary/CSRF
[cookies]: #cookies
[sessions]: #sessions
[session-storage]: https://api.reactrouter.com/v7/interfaces/react-router.SessionStorage
[session-api]: https://api.reactrouter.com/v7/interfaces/react-router.Session
[is-session]: https://api.reactrouter.com/v7/functions/react-router.isSession
[cookie-api]: https://api.reactrouter.com/v7/interfaces/react-router.Cookie
[create-session-storage]: https://api.reactrouter.com/v7/functions/react-router.createSessionStorage
[create-session]: https://api.reactrouter.com/v7/functions/react-router.createSession
[create-memory-session-storage]: https://api.reactrouter.com/v7/functions/react-router.createMemorySessionStorage
[create-file-session-storage]: https://api.reactrouter.com/v7/functions/_react-router_node.createFileSessionStorage
[create-workers-kv-session-storage]: https://api.reactrouter.com/v7/functions/_react-router_cloudflare.createWorkersKVSessionStorage
[create-arc-table-session-storage]: https://api.reactrouter.com/v7/functions/_react-router_architect.createArcTableSessionStorage
[cookie]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
[cookie-attrs]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes
[is-cookie]: https://api.reactrouter.com/v7/functions/react-router.isCookie
[create-cookie]: https://api.reactrouter.com/v7/functions/react-router.createCookie

---

## Page 134 — `docs/explanation/special-files.md`

Live URL: https://reactrouter.com/explanation/special-files

# Special Files
The content of this page has been moved to the following:
- [`react-router.config.ts`](../api/framework-conventions/react-router.config.ts) - Optional configuration file for your app
- [`root.tsx`](../api/framework-conventions/root.tsx) - Required root route that renders the HTML document
- [`routes.ts`](../api/framework-conventions/routes.ts) - Required route configuration mapping URLs to components
- [`entry.client.tsx`](../api/framework-conventions/entry.client.tsx) - Optional client-side entry point for hydration
- [`entry.server.tsx`](../api/framework-conventions/entry.server.tsx) - Optional server-side entry point for rendering
- [`.server` modules](../api/framework-conventions/server-modules) - Server-only modules excluded from client bundles
- [`.client` modules](../api/framework-conventions/client-modules) - Client-only modules excluded from server bundles

---

## Page 135 — `docs/explanation/state-management.md`

Live URL: https://reactrouter.com/explanation/state-management

# State Management
[MODES: framework, data]
<br/>
<br/>
State management in React typically involves maintaining a synchronized cache of server data on the client side. However, when using React Router as your framework, most of the traditional caching solutions become redundant because of how it inherently handles data synchronization.
## Understanding State Management in React
In a typical React context, when we refer to "state management", we're primarily discussing how we synchronize server state with the client. A more apt term could be "cache management" because the server is the source of truth and the client state is mostly functioning as a cache.
Popular caching solutions in React include:
- **[Redux][redux]:** A predictable state container for JavaScript apps.
- **[TanStack Query][tanstack_query]:** Hooks for fetching, caching, and updating asynchronous data in React.
- **[Apollo][apollo]:** A comprehensive state management library for JavaScript that integrates with GraphQL.
In certain scenarios, using these libraries may be warranted. However, with React Router's unique server-focused approach, their utility becomes less prevalent. In fact, most React Router applications forgo them entirely.
## How React Router Simplifies State
React Router seamlessly bridges the gap between the backend and frontend via mechanisms like loaders, actions, and forms with automatic synchronization through revalidation. This offers developers the ability to directly use server state within components without managing a cache, the network communication, or data revalidation, making most client-side caching redundant.
Here's why using typical React state patterns might be an anti-pattern in React Router:
1. **Network-related State:** If your React state is managing anything related to the network—such as data from loaders, pending form submissions, or navigational states—it's likely that you're managing state that React Router already manages:
   - **[`useNavigation`][use_navigation]**: This hook gives you access to `navigation.state`, `navigation.formData`, `navigation.location`, etc.
   - **[`useFetcher`][use_fetcher]**: This facilitates interaction with `fetcher.state`, `fetcher.formData`, `fetcher.data` etc.
   - **[`loaderData`][loader_data]**: Access the data for a route.
   - **[`actionData`][action_data]**: Access the data from the latest action.
2. **Storing Data in React Router:** A lot of data that developers might be tempted to store in React state has a more natural home in React Router, such as:
   - **URL Search Params:** Parameters within the URL that hold state.
   - **[Cookies][cookies]:** Small pieces of data stored on the user's device.
   - **[Server Sessions][sessions]:** Server-managed user sessions.
   - **Server Caches:** Cached data on the server side for quicker retrieval.
3. **Performance Considerations:** At times, client state is leveraged to avoid redundant data fetching. With React Router, you can use the [`Cache-Control`][cache_control_header] headers within `loader`s, allowing you to tap into the browser's native cache. However, this approach has its limitations and should be used judiciously. It's usually more beneficial to optimize backend queries or implement a server cache. This is because such changes benefit all users and do away with the need for individual browser caches.
As a developer transitioning to React Router, it's essential to recognize and embrace its inherent efficiencies rather than applying traditional React patterns. React Router offers a streamlined solution to state management leading to less code, fresh data, and no state synchronization bugs.
## Examples
### Network Related State
For examples on using React Router's internal state to manage network related state, refer to [Pending UI][pending_ui].
### URL Search Params
Consider a UI that lets the user customize between list view or detail view. Your instinct might be to reach for React state:
```tsx bad lines=[2,6,9]
export function List() {
  const [view, setView] = useState("list");
  return (
    <div>
      <div>
        <button onClick={() => setView("list")}>
          View as List
        </button>
        <button onClick={() => setView("details")}>
          View with Details
        </button>
      </div>
      {view === "list" ? <ListView /> : <DetailView />}
    </div>
  );
}
```
Now consider you want the URL to update when the user changes the view. Note the state synchronization:
```tsx bad lines=[7,16,24]
export function List() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState(
    searchParams.get("view") || "list",
  );
  return (
    <div>
      <div>
        <button
          onClick={() => {
            setView("list");
            navigate(`?view=list`);
          }}
        >
          View as List
        </button>
        <button
          onClick={() => {
            setView("details");
            navigate(`?view=details`);
          }}
        >
          View with Details
        </button>
      </div>
      {view === "list" ? <ListView /> : <DetailView />}
    </div>
  );
}
```
Instead of synchronizing state, you can simply read and set the state in the URL directly with boring old HTML forms:
```tsx good lines=[5,9-16]
export function List() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "list";
  return (
    <div>
      <Form>
        <button name="view" value="list">
          View as List
        </button>
        <button name="view" value="details">
          View with Details
        </button>
      </Form>
      {view === "list" ? <ListView /> : <DetailView />}
    </div>
  );
}
```
### Persistent UI State
Consider a UI that toggles a sidebar's visibility. We have three ways to handle the state:
1. React state
2. Browser local storage
3. Cookies
In this discussion, we'll break down the trade-offs associated with each method.
#### React State
React state provides a simple solution for temporary state storage.
**Pros**:
- **Simple**: Easy to implement and understand.
- **Encapsulated**: State is scoped to the component.
**Cons**:
- **Transient**: Doesn't survive page refreshes, returning to the page later, or unmounting and remounting the component.
**Implementation**:
```tsx
function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setIsOpen((open) => !open)}>
        {isOpen ? "Close" : "Open"}
      </button>
      <aside hidden={!isOpen}>
        <Outlet />
      </aside>
    </div>
  );
}
```
#### Local Storage
To persist state beyond the component lifecycle, browser local storage is a step-up. See our doc on [Client Data][client_data] for more advanced examples.
**Pros**:
- **Persistent**: Maintains state across page refreshes and component mounts/unmounts.
- **Encapsulated**: State is scoped to the component.
**Cons**:
- **Requires Synchronization**: React components must sync up with local storage to initialize and save the current state.
- **Server Rendering Limitation**: The [`window`][window_global] and [`localStorage`][local_storage_global] objects are not accessible during server-side rendering, so state must be initialized in the browser with an effect.
- **UI Flickering**: On initial page loads, the state in local storage may not match what was rendered by the server and the UI will flicker when JavaScript loads.
**Implementation**:
```tsx
function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  // synchronize initially
  useLayoutEffect(() => {
    const isOpen = window.localStorage.getItem("sidebar");
    setIsOpen(isOpen);
  }, []);
  // synchronize on change
  useEffect(() => {
    window.localStorage.setItem("sidebar", isOpen);
  }, [isOpen]);
  return (
    <div>
      <button onClick={() => setIsOpen((open) => !open)}>
        {isOpen ? "Close" : "Open"}
      </button>
      <aside hidden={!isOpen}>
        <Outlet />
      </aside>
    </div>
  );
}
```
In this approach, state must be initialized within an effect. This is crucial to avoid complications during server-side rendering. Directly initializing the React state from `localStorage` will cause errors since `window.localStorage` is unavailable during server rendering.
```tsx bad lines=[4]
function Sidebar() {
  const [isOpen, setIsOpen] = useState(
    // error: window is not defined
    window.localStorage.getItem("sidebar"),
  );
  // ...
}
```
By initializing the state within an effect, there's potential for a mismatch between the server-rendered state and the state stored in local storage. This discrepancy will lead to brief UI flickering shortly after the page renders and should be avoided.
#### Cookies
Cookies offer a comprehensive solution for this use case. However, this method introduces added preliminary setup before making the state accessible within the component.
**Pros**:
- **Server Rendering**: State is available on the server for rendering and even for server actions.
- **Single Source of Truth**: Eliminates state synchronization hassles.
- **Persistence**: Maintains state across page loads and component mounts/unmounts. State can even persist across devices if you switch to a database-backed session.
- **Progressive Enhancement**: Functions even before JavaScript loads.
**Cons**:
- **Boilerplate**: Requires more code because of the network.
- **Exposed**: The state is not encapsulated to a single component, other parts of the app must be aware of the cookie.
**Implementation**:
First we'll need to create a cookie object:
```tsx
```
Next we set up the server action and loader to read and write the cookie:
```tsx filename=app/routes/sidebar.tsx
// read the state from the cookie
export async function loader({
  request,
}: Route.LoaderArgs) {
  const cookieHeader = request.headers.get("Cookie");
  const cookie = (await prefs.parse(cookieHeader)) || {};
  return data({ sidebarIsOpen: cookie.sidebarIsOpen });
}
// write the state to the cookie
export async function action({
  request,
}: Route.ActionArgs) {
  const cookieHeader = request.headers.get("Cookie");
  const cookie = (await prefs.parse(cookieHeader)) || {};
  const formData = await request.formData();
  const isOpen = formData.get("sidebar") === "open";
  cookie.sidebarIsOpen = isOpen;
  return data(isOpen, {
    headers: {
      "Set-Cookie": await prefs.serialize(cookie),
    },
  });
}
```
After the server code is set up, we can use the cookie state in our UI:
```tsx
function Sidebar({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher();
  let { sidebarIsOpen } = loaderData;
  // use optimistic UI to immediately change the UI state
  if (fetcher.formData?.has("sidebar")) {
    sidebarIsOpen =
      fetcher.formData.get("sidebar") === "open";
  }
  return (
    <div>
      <fetcher.Form method="post">
        <button
          name="sidebar"
          value={sidebarIsOpen ? "closed" : "open"}
        >
          {sidebarIsOpen ? "Close" : "Open"}
        </button>
      </fetcher.Form>
      <aside hidden={!sidebarIsOpen}>
        <Outlet />
      </aside>
    </div>
  );
}
```
While this is certainly more code that touches more of the application to account for the network requests and responses, the UX is greatly improved. Additionally, state comes from a single source of truth without any state synchronization required.
In summary, each of the discussed methods offers a unique set of benefits and challenges:
- **React state**: Offers simple but transient state management.
- **Local Storage**: Provides persistence but with synchronization requirements and UI flickering.
- **Cookies**: Delivers robust, persistent state management at the cost of added boilerplate.
None of these are wrong, but if you want to persist the state across visits, cookies offer the best user experience.
### Form Validation and Action Data
Client-side validation can augment the user experience, but similar enhancements can be achieved by leaning more towards server-side processing and letting it handle the complexities.
The following example illustrates the inherent complexities of managing network state, coordinating state from the server, and implementing validation redundantly on both the client and server sides. It's just for illustration, so forgive any obvious bugs or problems you find.
```tsx bad lines=[2,11,27,38,63]
export function Signup() {
  // A multitude of React State declarations
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState("");
  const [userNameError, setUserNameError] = useState(null);
  const [password, setPassword] = useState(null);
  const [passwordError, setPasswordError] = useState("");
  // Replicating server-side logic in the client
  function validateForm() {
    setUserNameError(null);
    setPasswordError(null);
    const errors = validateSignupForm(userName, password);
    if (errors) {
      if (errors.userName) {
        setUserNameError(errors.userName);
      }
      if (errors.password) {
        setPasswordError(errors.password);
      }
    }
    return Boolean(errors);
  }
  // Manual network interaction handling
  async function handleSubmit() {
    if (validateForm()) {
      setSubmitting(true);
      const res = await postJSON("/api/signup", {
        userName,
        password,
      });
      const json = await res.json();
      setIsSubmitting(false);
      // Server state synchronization to the client
      if (json.errors) {
        if (json.errors.userName) {
          setUserNameError(json.errors.userName);
        }
        if (json.errors.password) {
          setPasswordError(json.errors.password);
        }
      }
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <p>
        <input
          type="text"
          name="username"
          value={userName}
          onChange={() => {
            // Synchronizing form state for the fetch
            setUserName(event.target.value);
          }}
        />
        {userNameError ? <i>{userNameError}</i> : null}
      </p>
      <p>
        <input
          type="password"
          name="password"
          onChange={(event) => {
            // Synchronizing form state for the fetch
            setPassword(event.target.value);
          }}
        />
        {passwordError ? <i>{passwordError}</i> : null}
      </p>
      <button disabled={isSubmitting} type="submit">
        Sign Up
      </button>
      {isSubmitting ? <BusyIndicator /> : null}
    </form>
  );
}
```
The backend endpoint, `/api/signup`, also performs validation and sends error feedback. Note that some essential validation, like detecting duplicate usernames, can only be done server-side using information the client doesn't have access to.
```tsx bad
export async function signupHandler(request: Request) {
  const errors = await validateSignupRequest(request);
  if (errors) {
    return { ok: false, errors: errors };
  }
  await signupUser(request);
  return { ok: true, errors: null };
}
```
Now, let's contrast this with a React Router-based implementation. The action remains consistent, but the component is vastly simplified due to the direct utilization of server state via `actionData`, and leveraging the network state that React Router inherently manages.
```tsx filename=app/routes/signup.tsx good lines=[20-22]
export async function action({
  request,
}: ActionFunctionArgs) {
  const errors = await validateSignupRequest(request);
  if (errors) {
    return { ok: false, errors: errors };
  }
  await signupUser(request);
  return { ok: true, errors: null };
}
export function Signup({
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const userNameError = actionData?.errors?.userName;
  const passwordError = actionData?.errors?.password;
  const isSubmitting = navigation.formAction === "/signup";
  return (
    <Form method="post">
      <p>
        <input type="text" name="username" />
        {userNameError ? <i>{userNameError}</i> : null}
      </p>
      <p>
        <input type="password" name="password" />
        {passwordError ? <i>{passwordError}</i> : null}
      </p>
      <button disabled={isSubmitting} type="submit">
        Sign Up
      </button>
      {isSubmitting ? <BusyIndicator /> : null}
    </Form>
  );
}
```
The extensive state management from our previous example is distilled into just three code lines. We eliminate the necessity for React state, change event listeners, submit handlers, and state management libraries for such network interactions.
Direct access to the server state is made possible through `actionData`, and network state through `useNavigation` (or `useFetcher`).
As bonus party trick, the form is functional even before JavaScript loads (see [Progressive Enhancement][progressive_enhancement]). Instead of React Router managing the network operations, the default browser behaviors step in.
If you ever find yourself entangled in managing and synchronizing state for network operations, React Router likely offers a more elegant solution.
[redux]: https://redux.js.org/
[tanstack_query]: https://tanstack.com/query/latest
[apollo]: https://www.apollographql.com/
[use_navigation]: https://api.reactrouter.com/v7/functions/react-router.useNavigation
[use_fetcher]: https://api.reactrouter.com/v7/functions/react-router.useFetcher
[loader_data]: ../start/framework/data-loading
[action_data]: ../start/framework/actions
[cookies]: ./sessions-and-cookies#cookies
[sessions]: ./sessions-and-cookies#sessions
[cache_control_header]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
[pending_ui]: ../start/framework/pending-ui
[client_data]: ../how-to/client-data
[window_global]: https://developer.mozilla.org/en-US/docs/Web/API/Window/window
[local_storage_global]: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
[progressive_enhancement]: ./progressive-enhancement

---

## Page 136 — `docs/explanation/styling.md`

Live URL: https://reactrouter.com/explanation/styling

# Styling
[MODES: framework]
<br/>
<br/>
Framework mode uses the React Router Vite plugin, so the styling story is mostly just Vite's styling story.
React Router does not have a separate CSS pipeline for Framework mode. In practice, there are three patterns that matter:
1. Import CSS as a side effect
2. Use the route module `links` export
3. Render a stylesheet `<link>` directly
## Side-Effect CSS Imports
Because Framework mode uses Vite, you can import CSS files as side effects:
```tsx filename=app/root.tsx
```
```tsx filename=app/routes/dashboard.tsx
```
This is often the simplest option. Global styles can be imported in `root.tsx`, and route or component styles can be imported next to the module that uses them.
## `links` Export
React Router also supports adding stylesheets through the route module `links` export.
This is useful when you want a stylesheet URL from Vite and need React Router to render a real `<link rel="stylesheet">` tag for the route:
```tsx filename=app/routes/dashboard.tsx
export function links() {
  return [{ rel: "stylesheet", href: dashboardHref }];
}
```
The `links` export feeds the [`<Links />`][links-component] component in your root route. This is the React Router-specific styling API in Framework mode. For more on route module exports, see [Route Module][route-module].
## Direct `<link>` Rendering
If you're using React 19, you can also render a stylesheet `<link>` directly in your route component:
```tsx filename=app/routes/dashboard.tsx
export default function Dashboard() {
  return (
    <>
      <link
        rel="stylesheet"
        href={dashboardHref}
        precedence="default"
      />
      <h1>Dashboard</h1>
    </>
  );
}
```
This uses React's built-in [`<link>`][react-link] support, which hoists the stylesheet into the document `<head>`. That gives you another way to colocate stylesheet tags with the route that needs them.
## Everything Else
For CSS Modules, Tailwind, PostCSS, Sass, Vanilla Extract, and other styling tools, use the normal Vite setup for those tools.
See:
- [Vite CSS Features][vite-css]
- [Vite Static Asset Handling][vite-assets]
- [`<Links />`][links-component]
[links-component]: ../api/components/Links
[react-link]: https://react.dev/reference/react-dom/components/link
[route-module]: ../start/framework/route-module
[vite-assets]: https://vite.dev/guide/assets.html
[vite-css]: https://vite.dev/guide/features.html#css

---

## Page 137 — `docs/explanation/type-safety.md`

Live URL: https://reactrouter.com/explanation/type-safety

# Type Safety
[MODES: framework]
<br/>
<br/>
If you haven't done so already, check out our guide for [setting up type safety][route-module-type-safety] in a new project.
React Router generates types for each route in your app to provide type safety for the route module exports.
For example, let's say you have a `products/:id` route configured:
```ts filename=app/routes.ts
export default [
  route("products/:id", "./routes/product.tsx"),
] satisfies RouteConfig;
```
You can import route-specific types like so:
```tsx filename=app/routes/product.tsx
// types generated for this route 👆
export function loader({ params }: Route.LoaderArgs) {
  //                      👆 { id: string }
  return { planet: `world #${params.id}` };
}
export default function Component({
  loaderData, // 👈 { planet: string }
}: Route.ComponentProps) {
  return <h1>Hello, {loaderData.planet}!</h1>;
}
```
## How it works
React Router's type generation executes your route config (`app/routes.ts` by default) to determine the routes for your app.
It then generates a `+types/<route file>.d.ts` for each route within a special `.react-router/types/` directory.
With [`rootDirs` configured][route-module-type-safety], TypeScript can import these generated files as if they were right next to their corresponding route modules.
For a deeper dive into some of the design decisions, check out our [type inference decision doc](https://github.com/remix-run/react-router/blob/dev/decisions/0012-type-inference.md).
[route-module-type-safety]: ../how-to/route-module-type-safety
## `typegen` command
You can manually generate types with the `typegen` command:
```sh
react-router typegen
```
The following types are generated for each route:
- `LoaderArgs`
- `ClientLoaderArgs`
- `ActionArgs`
- `ClientActionArgs`
- `HydrateFallbackProps`
- `ComponentProps` (for the `default` export)
- `ErrorBoundaryProps`
### --watch
If you run `react-router dev` — or if your custom server calls `vite.createServer` — then React Router's Vite plugin is already generating up-to-date types for you.
But if you really need to run type generation on its own, you can also use `--watch` to automatically regenerate types as files change:
```sh
react-router typegen --watch
```

---

## Page 138 — `docs/how-to/accessibility.md`

Live URL: https://reactrouter.com/how-to/accessibility

# Accessibility
Accessibility in a React Router app looks a lot like accessibility on the web in general. Using proper semantic markup and following the [Web Content Accessibility Guidelines (WCAG)][wcag] will get you most of the way there.
React Router makes certain accessibility practices the default where possible and provides APIs to help where it's not.
## Links
[MODES: framework, data, declarative]
<br/>
<br/>
The [`<Link>` component][link] renders a standard anchor tag, meaning that you get its accessibility behaviors from the browser for free!
React Router also provides the [`<NavLink/>`][navlink] which behaves the same as `<Link>`, but it also provides context for assistive technology when the link points to the current page. This is useful for building navigation menus or breadcrumbs.
## Routing
[MODES: framework]
<br/>
<br/>
If you are rendering [`<Scripts>`][scripts] in your app, there are some important things to consider to make client-side routing more accessible for your users.
With a traditional multi-page website we don't have to think about route changes too much. Your app renders an anchor tag, and the browser handles the rest. If your users disable JavaScript, your React Router app should already work this way by default!
When the client scripts in React Router are loaded, React Router takes control of routing and prevents the browser's default behavior. React Router doesn't make any assumptions about your UI as the route changes. There are some important features you'll want to consider as a result, including:
- **Focus management:** What element receives focus when the route changes? This is important for keyboard users and can be helpful for screen-reader users.
- **Live-region announcements:** Screen-reader users also benefit from announcements when a route has changed. You may want to also notify them during certain transition states depending on the nature of the change and how long loading is expected to take.
In 2019, [Marcy Sutton led and published findings from user research][marcy-sutton-led-and-published-findings-from-user-research] to help developers build accessible client-side routing experiences.
[link]: ../api/components/Link
[navlink]: ../api/components/NavLink
[scripts]: ../api/components/Scripts
[wcag]: https://www.w3.org/WAI/standards-guidelines/wcag/
[marcy-sutton-led-and-published-findings-from-user-research]: https://www.gatsbyjs.com/blog/2019-07-11-user-testing-accessible-client-routing

---

## Page 139 — `docs/how-to/client-data.md`

Live URL: https://reactrouter.com/how-to/client-data

# Client Data
[MODES: framework]
<br/>
<br/>
You can fetch and mutate data directly in the browser using `clientLoader` and `clientAction` functions.
These functions are the primary mechanism for data handling when using [SPA mode][spa]. This guide demonstrates common use cases for leveraging client data in Server-Side Rendering (SSR).
## Skip the Server Hop
When using React Router with a Backend-For-Frontend (BFF) architecture, you might want to bypass the React Router server and communicate directly with your backend API. This approach requires proper authentication handling and assumes no CORS restrictions. Here's how to implement this:
1. Load the data from server `loader` on the document load
2. Load the data from the `clientLoader` on all subsequent loads
In this scenario, React Router will _not_ call the `clientLoader` on hydration - and will only call it on subsequent navigations.
```tsx lines=[4,11]
export async function loader({
  request,
}: Route.LoaderArgs) {
  const data = await fetchApiFromServer({ request }); // (1)
  return data;
}
export async function clientLoader({
  request,
}: Route.ClientLoaderArgs) {
  const data = await fetchApiFromClient({ request }); // (2)
  return data;
}
```
## Fullstack State
Sometimes you need to combine data from both the server and browser (like IndexedDB or browser SDKs) before rendering a component. Here's how to implement this pattern:
1. Load the partial data from server `loader` on the document load
2. Export a [`HydrateFallback`][hydratefallback] component to render during SSR because we don't yet have a full set of data
3. Set `clientLoader.hydrate = true`, this instructs React Router to call the clientLoader as part of initial document hydration
4. Combine the server data with the client data in `clientLoader`
```tsx lines=[4-6,19-20,23,26]
export async function loader({
  request,
}: Route.LoaderArgs) {
  const partialData = await getPartialDataFromDb({
    request,
  }); // (1)
  return partialData;
}
export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  const [serverData, clientData] = await Promise.all([
    serverLoader(),
    getClientData(request),
  ]);
  return {
    ...serverData, // (4)
    ...clientData, // (4)
  };
}
clientLoader.hydrate = true as const; // (3)
export function HydrateFallback() {
  return <p>Skeleton rendered during SSR</p>; // (2)
}
export default function Component({
  // This will always be the combined set of server + client data
  loaderData,
}: Route.ComponentProps) {
  return <>...</>;
}
```
## Choosing Server or Client Data Loading
You can mix data loading strategies across your application, choosing between server-only or client-only data loading for each route. Here's how to implement both approaches:
1. Export a `loader` when you want to use server data
2. Export `clientLoader` and a `HydrateFallback` when you want to use client data
A route that only depends on a server loader looks like this:
```tsx filename=app/routes/server-data-route.tsx
export async function loader({
  request,
}: Route.LoaderArgs) {
  const data = await getServerData(request);
  return data;
}
export default function Component({
  loaderData, // (1) - server data
}: Route.ComponentProps) {
  return <>...</>;
}
```
A route that only depends on a client loader looks like this.
```tsx filename=app/routes/client-data-route.tsx
export async function clientLoader({
  request,
}: Route.ClientLoaderArgs) {
  const clientData = await getClientData(request);
  return clientData;
}
// Note: you do not have to set this explicitly - it is implied if there is no `loader`
clientLoader.hydrate = true;
// (2)
export function HydrateFallback() {
  return <p>Skeleton rendered during SSR</p>;
}
export default function Component({
  loaderData, // (2) - client data
}: Route.ComponentProps) {
  return <>...</>;
}
```
## Client-Side Caching
You can implement client-side caching (using memory, localStorage, etc.) to optimize server requests. Here's a pattern that demonstrates cache management:
1. Load the data from server `loader` on the document load
2. Set `clientLoader.hydrate = true` to prime the cache
3. Load subsequent navigations from the cache via `clientLoader`
4. Invalidate the cache in your `clientAction`
Note that since we are not exporting a `HydrateFallback` component, we will SSR the route component and then run the `clientLoader` on hydration, so it's important that your `loader` and `clientLoader` return the same data on initial load to avoid hydration errors.
```tsx lines=[4,26,32,39,46]
export async function loader({
  request,
}: Route.LoaderArgs) {
  const data = await getDataFromDb({ request }); // (1)
  return data;
}
export async function action({
  request,
}: Route.ActionArgs) {
  await saveDataToDb({ request });
  return { ok: true };
}
let isInitialRequest = true;
export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  const cacheKey = generateKey(request);
  if (isInitialRequest) {
    isInitialRequest = false;
    const serverData = await serverLoader();
    cache.set(cacheKey, serverData); // (2)
    return serverData;
  }
  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    return cachedData; // (3)
  }
  const serverData = await serverLoader();
  cache.set(cacheKey, serverData);
  return serverData;
}
clientLoader.hydrate = true; // (2)
export async function clientAction({
  request,
  serverAction,
}: Route.ClientActionArgs) {
  const cacheKey = generateKey(request);
  cache.delete(cacheKey); // (4)
  const serverData = await serverAction();
  return serverData;
}
```
[spa]: ../how-to/spa
[hydratefallback]: ../start/framework/route-module#hydratefallback

---

## Page 140 — `docs/how-to/data-strategy.md`

Live URL: https://reactrouter.com/how-to/data-strategy

# Data Strategy
[MODES: data]
<br />
<br />
<docs-warning>This is a low-level API intended for advanced use-cases. This overrides React Router's internal handling of `action`/`loader` execution, and if done incorrectly will break your app code. Please use with caution and perform the appropriate testing.</docs-warning>
## Overview
By default, React Router is opinionated about how your data is loaded/submitted - and most notably, executes all of your [`loader`][loader] functions in parallel for optimal data fetching. While we think this is the right behavior for most use-cases, we realize that there is no "one size fits all" solution when it comes to data fetching for the wide landscape of application requirements.
The [`dataStrategy`][data-strategy] option gives you full control over how your [`action`][action]/[`loader`][loader] functions are executed and lays the foundation to build in more advanced APIs such as middleware, context, and caching layers. Over time, we expect that we'll leverage this API internally to bring more first class APIs to React Router, but until then (and beyond), this is your way to add more advanced functionality for your application's data needs.
## Usage
A custom `dataStrategy` receives the `loader`/`action` arguments (`request`, `params`, `context`) plus a few more that allow you to decide how you want to control the executions for your application:
- `matches`: An array of `DataStrategyMatch` instances for the routes matched by the current `request`
- `runClientMiddleware`: A helper function to run the middleware for the matched routes
- `fetcherKey`: The fetcher key if this is for a fetcher request and not a navigation
A `DataStrategyMatch` is a normal route match plus a few additional fields:
- `shouldCallHandler`: A function that tells you whether this routes handler should be called for this request
- `shouldRevalidateArgs`: The arguments that to be passed to the routes `shouldRevalidate` for this request
- ~~`shouldLoad`~~: A boolean field for whether this routes handler should be run for this request
  - Deprecated in favor of the more powerful `shouldCallHandler` API
- `resolve`: A function to handle call through to the route handler, and also allow you custom execution of the handler
Here's a basic example that adds logging around the handler executions:
```tsx
let router = createBrowserRouter(routes, {
  async dataStrategy({
    matches,
    request,
    runClientMiddleware,
  }) {
    // Determine which matches are expected to be executed for this request.
    // - For loading navigations, this will return true for new routes + existing
    //   routes requiring revalidation
    // - For submission navigations, this will only return true for the action route
    // - For fetcher calls, this will only return true for the fetcher route
    const matchesToLoad = matches.filter((m) =>
      m.shouldCallHandler(),
    );
    // For each match that we want to execute, call match.resolve() to execute
    // the handler and store the result
    const results: Record<string, DataStrategyResult> = {};
    await runClientMiddleware(() =>
      Promise.all(
        matchesToLoad.map(async (match) => {
          console.log(`Processing ${match.route.id}`);
          // The resolve function calls through to the route handler
          results[match.route.id] = await match.resolve();
        }),
      ),
    );
    return results;
  },
});
```
The `dataStrategy` function should return a `Record<string, DataStrategyResult>` which contains the result for each handler that was executed. A `DataStrategyResult` is just a wrapper object that indicates if the handler returned or threw:
```ts
interface DataStrategyResult {
  type: "data" | "error";
  result: unknown; // data, Error, Response, data()
}
```
### Calling Route Middleware
If you are using `middleware` on your routes, you need to leverage the `callClientMiddleware` helper function to execute `middleware` around your handlers:
```tsx
let router = createBrowserRouter(routes, {
  async dataStrategy({
    matches,
    request,
    runClientMiddleware,
  }) {
    const matchesToLoad = matches.filter((m) =>
      m.shouldCallHandler(),
    );
    const results: Record<string, DataStrategyResult> = {};
    // Run middleware and execute handlers at the end of the middleware chain
    await runClientMiddleware(() =>
      Promise.all(
        matchesToLoad.map(async (match) => {
          results[match.route.id] = await match.resolve();
        }),
      ),
    );
    return results;
  },
});
```
`runClientMiddleware` takes the same arguments as `dataStrategy` so it can also be easily composed with a standalone `dataStrategy` implementation:
```tsx
const loggingDataStrategy: DataStrategyFunction = () => {
  /* ... */
};
let router = createBrowserRouter(routes, {
  async dataStrategy({ runClientMiddleware }) {
    let results = await runClientMiddleware(
      loggingDataStrategy,
    );
    return results;
  },
});
```
### Advanced handler execution
If you want more fine-grained control over the execution of the handler, you can pass a callback to `match.resolve()`:
```tsx
// Assume a loader shape such as
function loader({ request }, customContext) {...}
// In your dataStrategy, you can pass this context from inside a resolve callback
await Promise.all(
  matchesToLoad.map((match, i) =>
    match.resolve((handler) => {
      let customContext = getCustomContext();
      // Call the handler and p[ass a custom parameter as the handler's second argument
      return handler(customContext);
    }),
  ),
);
```
### Custom Revalidation Behavior
If you want to alter the revalidation behavior, you can pass your own `defaultShouldRevalidate` to `match.shouldCallHandler()` which will pass through to any route level `shouldRevalidate` functions. The arguments that would be passed to the route level `shouldRevalidate` are available on `match.shouldRevalidateArgs`:
```tsx
const matchesToLoad = matches.filter((match) => {
  let defaultShouldRevalidate = customShouldRevalidate(
    match.shouldRevalidateArgs,
  );
  return m.shouldCallHandler(defaultShouldRevalidate);
});
```
## Migrating away from `shouldLoad`
Now that we have stabilized the new `match.shouldCallHandler()`/`match.shouldRevalidateArgs` fields, it's recommended to move away from the now-deprecated `match.shouldLoad` API. The prior boolean approach did not allow for custom `dataStrategy`functions to alter the default revalidation behavior, so the new function-based APIs were created to allow that.
The major difference between these two APIs is that when using `shouldLoad`, calling `resolve()` would _only_ call the handler if `shouldLoad` was `true`. You could safely call it for all matches even if only a subset needed to have their handlers executed.
With `shouldCallHandler`, you are in charge of which handlers should be called so calling resolve will automatically call the handler. You should only call resolve on a the set of matches you wish to run handlers for.
Here's an example change from the prior API to the new API. Note that we pre-filter the `matchesToLoad` before calling `resolve()`:
```diff
let results = {};
+let matchesToLoad = matches.filter(m => m.shouldCallHandler());
await Promise.all(() =>
-  matches.map((m) => {
+  matchesToLoad.map((m) => {
    results[m.route.id] = await m.resolve();
  }),
);
return results;
```
## Advanced Use Cases
### Custom Middleware
<docs-info>This is an unlikely use-case now that React Router has built-in middleware, but if you wish to use a custom middleware you can do so with a `dataStrategy`.</docs-info>
Let's define a middleware on each route via [`handle`](../../start/data/route-object#handle)
and call middleware sequentially first, then call all
[`loader`](../../start/data/route-object#loader)s in parallel - providing
any data made available via the middleware:
```ts
const routes = [
  {
    id: "parent",
    path: "/parent",
    loader({ request }, context) {
      // ...
    },
    handle: {
      async middleware({ request }, context) {
        context.parent = "PARENT MIDDLEWARE";
      },
    },
    children: [
      {
        id: "child",
        path: "child",
        loader({ request }, context) {
          // ...
        },
        handle: {
          async middleware({ request }, context) {
            context.child = "CHILD MIDDLEWARE";
          },
        },
      },
    ],
  },
];
let router = createBrowserRouter(routes, {
  async dataStrategy({ matches, params, request }) {
    // Run middleware sequentially and let them add data to `context`
    let context = {};
    for (const match of matches) {
      if (match.route.handle?.middleware) {
        await match.route.handle.middleware(
          { request, params },
          context,
        );
      }
    }
    // Run loaders in parallel with the `context` value
    let matchesToLoad = matches.filter((m) =>
      m.shouldCallHandler(),
    );
    let results = await Promise.all(
      matchesToLoad.map((match, i) =>
        match.resolve((handler) => {
          // Whatever you pass to `handler` will be passed as the 2nd parameter
          // to your loader/action
          return handler(context);
        }),
      ),
    );
    return results.reduce(
      (acc, result, i) =>
        Object.assign(acc, {
          [matchesToLoad[i].route.id]: result,
        }),
      {},
    );
  },
});
```
### Custom Handler
It's also possible you don't even want to define a [`loader`](../../start/daoute-object#loader)
implementation at the route level. Maybe you want to just determine the
routes and issue a single GraphQL request for all of your data. You can do
that by setting your `route.loader=true` so it qualifies as "having a
loader", and then store GQL fragments on `route.handle`:
```ts
const routes = [
  {
    id: "parent",
    path: "/parent",
    loader: true,
    handle: {
      gql: gql`
        fragment Parent on Whatever {
          parentField
        }
      `,
    },
    children: [
      {
        id: "child",
        path: "child",
        loader: true,
        handle: {
          gql: gql`
            fragment Child on Whatever {
              childField
            }
          `,
        },
      },
    ],
  },
];
let router = createBrowserRouter(routes, {
  async dataStrategy({ matches, params, request }) {
    const matchesToLoad = matches.filter((m) =>
      m.shouldCallHandler(),
    );
    // Compose route fragments into a single GQL payload
    let gql = getFragmentsFromRouteHandles(matchesToLoad);
    let data = await fetchGql(gql);
    // Parse results back out into individual route level `DataStrategyResult`'s
    // keyed by `routeId`
    let results = parseResultsFromGql(matchesToLoad, data);
    return results;
  },
});
```
Note that we never actually call `match.resolve()` in this scenario since we don't want to call the handlers defined on the routes. We instead make a single GQL call and split the resulting data back out to the proper routes in `results`.
[loader]: ../start/data/route-object#loader
[action]: ../start/data/route-object#action
[data-strategy]: ../api/data-routers/createBrowserRouter#optsdatastrategy

---

## Page 141 — `docs/how-to/error-boundary.md`

Live URL: https://reactrouter.com/how-to/error-boundary

# Error Boundaries
[MODES: framework, data]
<br/>
<br/>
To avoid rendering an empty page to users, route modules will automatically catch errors in your code and render the closest `ErrorBoundary`.
Error boundaries are not intended for rendering form validation errors or error reporting. Please see [Form Validation](./form-validation) and [Error Reporting](./error-reporting) instead.
## 1. Add a root error boundary
All applications should at a minimum export a root error boundary. This one handles the three main cases:
- Thrown `data` with a status code and text
- Instances of errors with a stack trace
- Randomly thrown values
### Framework Mode
[modes: framework]
In [Framework Mode][picking-a-mode], errors are passed to the route-level error boundary as a prop (see [`Route.ErrorBoundaryProps`][type-safety]), so you don't need to use a hook to grab it:
```tsx filename=root.tsx lines=[1,3-5]
export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <>
        <h1>
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </>
    );
  } else if (error instanceof Error) {
    return (
      <div>
        <h1>Error</h1>
        <p>{error.message}</p>
        <p>The stack trace is:</p>
        <pre>{error.stack}</pre>
      </div>
    );
  } else {
    return <h1>Unknown Error</h1>;
  }
}
```
### Data Mode
[modes: data]
In [Data Mode][picking-a-mode], the `ErrorBoundary` doesn't receive props, so you can access it via `useRouteError`:
```tsx lines=[1,6,16]
let router = createBrowserRouter([
  {
    path: "/",
    ErrorBoundary: RootErrorBoundary,
    Component: Root,
  },
]);
function Root() {
  /* ... */
}
function RootErrorBoundary() {
  let error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return (
      <>
        <h1>
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </>
    );
  } else if (error instanceof Error) {
    return (
      <div>
        <h1>Error</h1>
        <p>{error.message}</p>
        <p>The stack trace is:</p>
        <pre>{error.stack}</pre>
      </div>
    );
  } else {
    return <h1>Unknown Error</h1>;
  }
}
```
## 2. Write a bug
[modes: framework,data]
It's not recommended to intentionally throw errors to force the error boundary to render as a means of control flow. Error Boundaries are primarily for catching unintentional errors in your code.
```tsx
export async function loader() {
  return undefined();
}
```
This will render the `instanceof Error` branch of the UI from step 1.
This is not just for loaders, but for all route module APIs: loaders, actions, components, headers, links, and meta.
## 3. Throw data in loaders/actions
[modes: framework,data]
There are exceptions to the rule in #2, especially 404s. You can intentionally `throw data()` (with a proper status code) to the closest error boundary when your loader can't find what it needs to render the page. Throw a 404 and move on.
```tsx
export async function loader({ params }) {
  let record = await fakeDb.getRecord(params.id);
  if (!record) {
    throw data("Record Not Found", { status: 404 });
  }
  return record;
}
```
This will render the `isRouteErrorResponse` branch of the UI from step 1.
## 4. Nested error boundaries
When an error is thrown, the "closest error boundary" will be rendered.
### Framework Mode
[modes: framework]
Consider these nested routes:
```tsx filename="routes.ts"
// ✅ has error boundary
route("/app", "app.tsx", [
  // ❌ no error boundary
  route("invoices", "invoices.tsx", [
    // ✅ has error boundary
    route("invoices/:id", "invoice-page.tsx", [
      // ❌ no error boundary
      route("payments", "payments.tsx"),
    ]),
  ]),
]);
```
The following table shows which error boundary will render given the origin of the error:
| error origin     | rendered boundary |
| ---------------- | ----------------- |
| app.tsx          | app.tsx           |
| invoices.tsx     | app.tsx           |
| invoice-page.tsx | invoice-page.tsx  |
| payments.tsx     | invoice-page.tsx  |
### Data Mode
[modes: data]
In Data Mode, the equivalent route tree might look like:
```tsx
let router = createBrowserRouter([
  {
    path: "/app",
    Component: App,
    ErrorBoundary: AppErrorBoundary, // ✅ has error boundary
    children: [
      {
        path: "invoices",
        Component: Invoices, // ❌ no error boundary
        children: [
          {
            path: ":id",
            Component: Invoice,
            ErrorBoundary: InvoiceErrorBoundary, // ✅ has error boundary
            children: [
              {
                path: "payments",
                Component: Payments, // ❌ no error boundary
              },
            ],
          },
        ],
      },
    ],
  },
]);
```
The following table shows which error boundary will render given the origin of the error:
| error origin | rendered boundary      |
| ------------ | ---------------------- |
| `App`        | `AppErrorBoundary`     |
| `Invoices`   | `AppErrorBoundary`     |
| `Invoice`    | `InvoiceErrorBoundary` |
| `Payments`   | `InvoiceErrorBoundary` |
## Error Sanitization
[modes: framework]
In Framework Mode when building for production, any errors that happen on the server are automatically sanitized before being sent to the browser to prevent leaking any sensitive server information (like stack traces).
This means that a thrown `Error` will have a generic message and no stack trace in production in the browser. The original error is untouched on the server.
Also note that data sent with `throw data(yourData)` is not sanitized as the data there is intended to be rendered.
[picking-a-mode]: ../start/modes
[type-safety]: ../explanation/type-safety

---

## Page 142 — `docs/how-to/error-reporting.md`

Live URL: https://reactrouter.com/how-to/error-reporting

# Error Reporting
[MODES: framework,data]
<br/>
<br/>
React Router catches errors in your route modules and sends them to [error boundaries](./error-boundary) to prevent blank pages when errors occur. However, `ErrorBoundary` isn't sufficient for logging and reporting errors.
## Server Errors
[modes: framework]
To access these caught errors on the server, use the `handleError` export of the server entry module.
### 1. Reveal the server entry
If you don't see [`entry.server.tsx`][entryserver] in your app directory, you're using a default entry. Reveal it with this cli command:
```shellscript nonumber
react-router reveal entry.server
```
### 2. Export your error handler
This function is called whenever React Router catches an error in your application on the server.
```tsx filename=entry.server.tsx
export const handleError: HandleErrorFunction = (
  error,
  { request },
) => {
  // React Router may abort some interrupted requests, don't log those
  if (!request.signal.aborted) {
    myReportError(error);
    // make sure to still log the error so you can see it
    console.error(error);
  }
};
```
See also:
- [`handleError`][handleError]
## Client Errors
To access these caught errors on the client, use the `onError` prop on your [`HydratedRouter`][hydratedrouter] or [`RouterProvider`][routerprovider] component.
### Framework Mode
[modes: framework]
#### 1. Reveal the client entry
If you don't see [`entry.client.tsx`][entryclient] in your app directory, you're using a default entry. Reveal it with this cli command:
```shellscript nonumber
react-router reveal entry.client
```
#### 2. Add your error handler
This function is called whenever React Router catches an error in your application on the client.
```tsx filename=entry.client.tsx
const onError: ClientOnErrorFunction = (
  error,
  { location, params, pattern, errorInfo },
) => {
  myReportError(error, location, errorInfo);
  // make sure to still log the error so you can see it
  console.error(error, errorInfo);
};
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter onError={onError} />
    </StrictMode>,
  );
});
```
See also:
- [`<HydratedRouter onError>`][hydratedrouter-onerror]
### Data Mode
[modes: data]
This function is called whenever React Router catches an error in your application on the client.
```tsx
const onError: ClientOnErrorFunction = (
  error,
  { location, params, pattern, errorInfo },
) => {
  myReportError(error, location, errorInfo);
  // make sure to still log the error so you can see it
  console.error(error, errorInfo);
};
function App() {
  return <RouterProvider onError={onError} />;
}
```
See also:
- [`<RouterProvider onError>`][routerprovider-onerror]
[entryserver]: ../api/framework-conventions/entry.server.tsx
[handleError]: ../api/framework-conventions/entry.server.tsx#handleerror
[entryclient]: ../api/framework-conventions/entry.client.tsx
[hydratedrouter]: ../api/framework-routers/HydratedRouter
[routerprovider]: ../api/data-routers/RouterProvider
[hydratedrouter-onerror]: ../api/framework-routers/HydratedRouter#onError
[routerprovider-onerror]: ../api/data-routers/RouterProvider#onError

---

## Page 143 — `docs/how-to/fetchers.md`

Live URL: https://reactrouter.com/how-to/fetchers

# Using Fetchers
[MODES: framework, data]
<br/>
<br/>
Fetchers are useful for creating complex, dynamic user interfaces that require multiple, concurrent data interactions without causing a navigation.
Fetchers track their own, independent state and can be used to load data, mutate data, submit forms, and generally interact with loaders and actions.
## Calling Actions
The most common case for a fetcher is to submit data to an action, triggering a revalidation of route data. Consider the following route module:
```tsx
export async function clientLoader({ request }) {
  let title = localStorage.getItem("title") || "No Title";
  return { title };
}
export default function Component() {
  let data = useLoaderData();
  return (
    <div>
      <h1>{data.title}</h1>
    </div>
  );
}
```
### 1. Add an action
First we'll add an action to the route for the fetcher to call:
```tsx lines=[7-11]
export async function clientLoader({ request }) {
  // ...
}
export async function clientAction({ request }) {
  await new Promise((res) => setTimeout(res, 1000));
  let data = await request.formData();
  localStorage.setItem("title", data.get("title"));
  return { ok: true };
}
export default function Component() {
  let data = useLoaderData();
  // ...
}
```
### 2. Create a fetcher
Next create a fetcher and render a form with it:
```tsx lines=[7,12-14]
// ...
export default function Component() {
  let data = useLoaderData();
  let fetcher = useFetcher();
  return (
    <div>
      <h1>{data.title}</h1>
      <fetcher.Form method="post">
        <input type="text" name="title" />
      </fetcher.Form>
    </div>
  );
}
```
### 3. Submit the form
If you submit the form now, the fetcher will call the action and revalidate the route data automatically.
### 4. Render pending state
Fetchers make their state available during the async work so you can render pending UI the moment the user interacts:
```tsx lines=[10]
export default function Component() {
  let data = useLoaderData();
  let fetcher = useFetcher();
  return (
    <div>
      <h1>{data.title}</h1>
      <fetcher.Form method="post">
        <input type="text" name="title" />
        {fetcher.state !== "idle" && <p>Saving...</p>}
      </fetcher.Form>
    </div>
  );
}
```
### 5. Optimistic UI
Sometimes there's enough information in the form to render the next state immediately. You can access the form data with `fetcher.formData`:
```tsx lines=[3-4,8]
export default function Component() {
  let data = useLoaderData();
  let fetcher = useFetcher();
  let title = fetcher.formData?.get("title") || data.title;
  return (
    <div>
      <h1>{title}</h1>
      <fetcher.Form method="post">
        <input type="text" name="title" />
        {fetcher.state !== "idle" && <p>Saving...</p>}
      </fetcher.Form>
    </div>
  );
}
```
### 6. Fetcher Data and Validation
Data returned from an action is available in the fetcher's `data` property. This is primarily useful for returning error messages to the user for a failed mutation:
```tsx lines=[7-10,28-32]
// ...
export async function clientAction({ request }) {
  await new Promise((res) => setTimeout(res, 1000));
  let data = await request.formData();
  let title = data.get("title") as string;
  if (title.trim() === "") {
    return { ok: false, error: "Title cannot be empty" };
  }
  localStorage.setItem("title", title);
  return { ok: true, error: null };
}
export default function Component() {
  let data = useLoaderData();
  let fetcher = useFetcher();
  let title = fetcher.formData?.get("title") || data.title;
  return (
    <div>
      <h1>{title}</h1>
      <fetcher.Form method="post">
        <input type="text" name="title" />
        {fetcher.state !== "idle" && <p>Saving...</p>}
        {fetcher.data?.error && (
          <p style={{ color: "red" }}>
            {fetcher.data.error}
          </p>
        )}
      </fetcher.Form>
    </div>
  );
}
```
## Loading Data
Another common use case for fetchers is to load data from a route for something like a combobox.
### 1. Create a search route
Consider the following route with a very basic search:
```tsx filename=./search-users.tsx
// { path: '/search-users', filename: './search-users.tsx' }
const users = [
  { id: 1, name: "Ryan" },
  { id: 2, name: "Michael" },
  // ...
];
export async function loader({ request }) {
  await new Promise((res) => setTimeout(res, 300));
  let url = new URL(request.url);
  let query = url.searchParams.get("q");
  return users.filter((user) =>
    user.name.toLowerCase().includes(query.toLowerCase()),
  );
}
```
### 2. Render a fetcher in a combobox component
```tsx
export function UserSearchCombobox() {
  let fetcher = useFetcher();
  return (
    <div>
      <fetcher.Form method="get" action="/search-users">
        <input type="text" name="q" />
      </fetcher.Form>
    </div>
  );
}
```
- The action points to the route we created above: "/search-users"
- The name of the input is "q" to match the query parameter
### 3. Add type inference
```tsx lines=[2,5]
export function UserSearchCombobox() {
  let fetcher = useFetcher<typeof loader>();
  // ...
}
```
Ensure you use `import type` so you only import the types.
### 4. Render the data
```tsx lines=[10-16]
export function UserSearchCombobox() {
  let fetcher = useFetcher<typeof loader>();
  return (
    <div>
      <fetcher.Form method="get" action="/search-users">
        <input type="text" name="q" />
      </fetcher.Form>
      {fetcher.data && (
        <ul>
          {fetcher.data.map((user) => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
Note you will need to hit "enter" to submit the form and see the results.
### 5. Render a pending state
```tsx lines=[12-14]
export function UserSearchCombobox() {
  let fetcher = useFetcher<typeof loader>();
  return (
    <div>
      <fetcher.Form method="get" action="/search-users">
        <input type="text" name="q" />
      </fetcher.Form>
      {fetcher.data && (
        <ul
          style={{
            opacity: fetcher.state === "idle" ? 1 : 0.25,
          }}
        >
          {fetcher.data.map((user) => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
### 6. Search on user input
Fetchers can be submitted programmatically with `fetcher.submit`:
```tsx lines=[5-7]
<fetcher.Form method="get" action="/search-users">
  <input
    type="text"
    name="q"
    onChange={(event) => {
      fetcher.submit(event.currentTarget.form);
    }}
  />
</fetcher.Form>
```
Note the input event's form is passed as the first argument to `fetcher.submit`. The fetcher will use that form to submit the request, reading its attributes and serializing the data from its elements.

---

## Page 144 — `docs/how-to/file-route-conventions.md`

Live URL: https://reactrouter.com/how-to/file-route-conventions

# File Route Conventions
[MODES: framework]
<br/>
<br/>
The `@react-router/fs-routes` package enables file-convention based route config.
## Setting up
First install the `@react-router/fs-routes` package:
```shellscript nonumber
npm i @react-router/fs-routes
```
Then use it to provide route config in your `app/routes.ts` file:
```tsx filename=app/routes.ts
export default flatRoutes() satisfies RouteConfig;
```
Any modules in the `app/routes` directory will become routes in your application by default.
The `ignoredRouteFiles` option allows you to specify files that should not be included as routes:
```tsx filename=app/routes.ts
export default flatRoutes({
  ignoredRouteFiles: ["home.tsx"],
}) satisfies RouteConfig;
```
This will look for routes in the `app/routes` directory by default, but this can be configured via the `rootDirectory` option which is relative to your app directory:
```tsx filename=app/routes.ts
export default flatRoutes({
  rootDirectory: "file-routes",
}) satisfies RouteConfig;
```
The rest of this guide will assume you're using the default `app/routes` directory.
## Basic Routes
The filename maps to the route's URL pathname, except for `_index.tsx` which is the [index route][index_route] for the [root route][root_route]. You can use `.js`, `.jsx`, `.ts` or `.tsx` file extensions.
```text lines=[3-4]
app/
├── routes/
│   ├── _index.tsx
│   └── about.tsx
└── root.tsx
```
| URL      | Matched Routes          |
| -------- | ----------------------- |
| `/`      | `app/routes/_index.tsx` |
| `/about` | `app/routes/about.tsx`  |
Note that these routes will be rendered in the outlet of `app/root.tsx` because of [nested routing][nested_routing].
## Dot Delimiters
Adding a `.` to a route filename will create a `/` in the URL.
```text lines=[5-7]
 app/
├── routes/
│   ├── _index.tsx
│   ├── about.tsx
│   ├── concerts.trending.tsx
│   ├── concerts.salt-lake-city.tsx
│   └── concerts.san-diego.tsx
└── root.tsx
```
| URL                        | Matched Route                            |
| -------------------------- | ---------------------------------------- |
| `/`                        | `app/routes/_index.tsx`                  |
| `/about`                   | `app/routes/about.tsx`                   |
| `/concerts/trending`       | `app/routes/concerts.trending.tsx`       |
| `/concerts/salt-lake-city` | `app/routes/concerts.salt-lake-city.tsx` |
| `/concerts/san-diego`      | `app/routes/concerts.san-diego.tsx`      |
The dot delimiter also creates nesting, see the [nesting section][nested_routes] for more information.
## Dynamic Segments
Usually your URLs aren't static but data-driven. Dynamic segments allow you to match segments of the URL and use that value in your code. You create them with the `$` prefix.
```text lines=[5]
 app/
├── routes/
│   ├── _index.tsx
│   ├── about.tsx
│   ├── concerts.$city.tsx
│   └── concerts.trending.tsx
└── root.tsx
```
| URL                        | Matched Route                      |
| -------------------------- | ---------------------------------- |
| `/`                        | `app/routes/_index.tsx`            |
| `/about`                   | `app/routes/about.tsx`             |
| `/concerts/trending`       | `app/routes/concerts.trending.tsx` |
| `/concerts/salt-lake-city` | `app/routes/concerts.$city.tsx`    |
| `/concerts/san-diego`      | `app/routes/concerts.$city.tsx`    |
The value will be parsed from the URL and passed to various APIs. We call these values "URL Parameters". The most useful places to access the URL params are in [loaders] and [actions].
```tsx
export async function loader({ params }) {
  return fakeDb.getAllConcertsForCity(params.city);
}
```
You'll note the property name on the `params` object maps directly to the name of your file: `$city.tsx` becomes `params.city`.
Routes can have multiple dynamic segments, like `concerts.$city.$date`, both are accessed on the params object by name:
```tsx
export async function loader({ params }) {
  return fake.db.getConcerts({
    date: params.date,
    city: params.city,
  });
}
```
See the [routing guide][routing_guide] for more information.
## Nested Routes
Nested Routing is the general idea of coupling segments of the URL to component hierarchy and data. You can read more about it in the [Routing Guide][nested_routing].
You create nested routes with [dot delimiters][dot_delimiters]. If the filename before the `.` matches another route filename, it automatically becomes a child route to the matching parent. Consider these routes:
```text lines=[5-8]
 app/
├── routes/
│   ├── _index.tsx
│   ├── about.tsx
│   ├── concerts._index.tsx
│   ├── concerts.$city.tsx
│   ├── concerts.trending.tsx
│   └── concerts.tsx
└── root.tsx
```
All the routes that start with `app/routes/concerts.` will be child routes of `app/routes/concerts.tsx` and render inside the [parent route's outlet][nested_routing].
| URL                        | Matched Route                      | Layout                    |
| -------------------------- | ---------------------------------- | ------------------------- |
| `/`                        | `app/routes/_index.tsx`            | `app/root.tsx`            |
| `/about`                   | `app/routes/about.tsx`             | `app/root.tsx`            |
| `/concerts`                | `app/routes/concerts._index.tsx`   | `app/routes/concerts.tsx` |
| `/concerts/trending`       | `app/routes/concerts.trending.tsx` | `app/routes/concerts.tsx` |
| `/concerts/salt-lake-city` | `app/routes/concerts.$city.tsx`    | `app/routes/concerts.tsx` |
Note you typically want to add an index route when you add nested routes so that something renders inside the parent's outlet when users visit the parent URL directly.
For example, if the URL is `/concerts/salt-lake-city` then the UI hierarchy will look like this:
```tsx
<Root>
  <Concerts>
    <City />
  </Concerts>
</Root>
```
## Nested URLs without Layout Nesting
Sometimes you want the URL to be nested, but you don't want the automatic layout nesting. You can opt out of nesting with a trailing underscore on the parent segment:
```text lines=[8]
 app/
├── routes/
│   ├── _index.tsx
│   ├── about.tsx
│   ├── concerts.$city.tsx
│   ├── concerts.trending.tsx
│   ├── concerts.tsx
│   └── concerts_.mine.tsx
└── root.tsx
```
| URL                        | Matched Route                      | Layout                    |
| -------------------------- | ---------------------------------- | ------------------------- |
| `/`                        | `app/routes/_index.tsx`            | `app/root.tsx`            |
| `/about`                   | `app/routes/about.tsx`             | `app/root.tsx`            |
| `/concerts/mine`           | `app/routes/concerts_.mine.tsx`    | `app/root.tsx`            |
| `/concerts/trending`       | `app/routes/concerts.trending.tsx` | `app/routes/concerts.tsx` |
| `/concerts/salt-lake-city` | `app/routes/concerts.$city.tsx`    | `app/routes/concerts.tsx` |
Note that `/concerts/mine` does not nest with `app/routes/concerts.tsx` anymore, but `app/root.tsx`. The `trailing_` underscore creates a path segment, but it does not create layout nesting.
Think of the `trailing_` underscore as the long bit at the end of your parent's signature, writing you out of the will, removing the segment that follows from the layout nesting.
## Nested Layouts without Nested URLs
We call these <a name="pathless-routes"><b>Pathless Routes</b></a>
Sometimes you want to share a layout with a group of routes without adding any path segments to the URL. A common example is a set of authentication routes that have a different header/footer than the public pages or the logged in app experience. You can do this with a `_leading` underscore.
```text lines=[3-5]
 app/
├── routes/
│   ├── _auth.login.tsx
│   ├── _auth.register.tsx
│   ├── _auth.tsx
│   ├── _index.tsx
│   ├── concerts.$city.tsx
│   └── concerts.tsx
└── root.tsx
```
| URL                        | Matched Route                   | Layout                    |
| -------------------------- | ------------------------------- | ------------------------- |
| `/`                        | `app/routes/_index.tsx`         | `app/root.tsx`            |
| `/login`                   | `app/routes/_auth.login.tsx`    | `app/routes/_auth.tsx`    |
| `/register`                | `app/routes/_auth.register.tsx` | `app/routes/_auth.tsx`    |
| `/concerts`                | `app/routes/concerts.tsx`       | `app/routes/concerts.tsx` |
| `/concerts/salt-lake-city` | `app/routes/concerts.$city.tsx` | `app/routes/concerts.tsx` |
Think of the `_leading` underscore as a blanket you're pulling over the filename, hiding the filename from the URL.
## Optional Segments
Wrapping a route segment in parentheses will make the segment optional.
```text lines=[3-5]
 app/
├── routes/
│   ├── ($lang)._index.tsx
│   ├── ($lang).$productId.tsx
│   └── ($lang).categories.tsx
└── root.tsx
```
| URL                        | Matched Route                       |
| -------------------------- | ----------------------------------- |
| `/`                        | `app/routes/($lang)._index.tsx`     |
| `/categories`              | `app/routes/($lang).categories.tsx` |
| `/en/categories`           | `app/routes/($lang).categories.tsx` |
| `/fr/categories`           | `app/routes/($lang).categories.tsx` |
| `/american-flag-speedo`    | `app/routes/($lang)._index.tsx`     |
| `/en/american-flag-speedo` | `app/routes/($lang).$productId.tsx` |
| `/fr/american-flag-speedo` | `app/routes/($lang).$productId.tsx` |
You may wonder why `/american-flag-speedo` is matching the `($lang)._index.tsx` route instead of `($lang).$productId.tsx`. This is because when you have an optional dynamic param segment followed by another dynamic param, it cannot reliably be determined if a single-segment URL such as `/american-flag-speedo` should match `/:lang` `/:productId`. Optional segments match eagerly and thus it will match `/:lang`. If you have this type of setup it's recommended to look at `params.lang` in the `($lang)._index.tsx` loader and redirect to `/:lang/american-flag-speedo` for the current/default language if `params.lang` is not a valid language code.
## Splat Routes
While [dynamic segments][dynamic_segments] match a single path segment (the stuff between two `/` in a URL), a splat route will match the rest of a URL, including the slashes.
```text lines=[4,6]
 app/
├── routes/
│   ├── _index.tsx
│   ├── $.tsx
│   ├── about.tsx
│   └── files.$.tsx
└── root.tsx
```
| URL                                          | Matched Route            |
| -------------------------------------------- | ------------------------ |
| `/`                                          | `app/routes/_index.tsx`  |
| `/about`                                     | `app/routes/about.tsx`   |
| `/beef/and/cheese`                           | `app/routes/$.tsx`       |
| `/files`                                     | `app/routes/files.$.tsx` |
| `/files/talks/react-conf_old.pdf`            | `app/routes/files.$.tsx` |
| `/files/talks/react-conf_final.pdf`          | `app/routes/files.$.tsx` |
| `/files/talks/react-conf-FINAL-MAY_2024.pdf` | `app/routes/files.$.tsx` |
Similar to dynamic route parameters, you can access the value of the matched path on the splat route's `params` with the `"*"` key.
```tsx filename=app/routes/files.$.tsx
export async function loader({ params }) {
  const filePath = params["*"];
  return fake.getFileInfo(filePath);
}
```
## Catch-all Route
To create a route that will match any requests that don't match other defined routes (such as a 404 page), create a file named `$.tsx` within your routes directory:
| URL                            | Matched Route           |
| ------------------------------ | ----------------------- |
| `/`                            | `app/routes/_index.tsx` |
| `/about`                       | `app/routes/about.tsx`  |
| `/any-invalid-path-will-match` | `app/routes/$.tsx`      |
By default the matched route will return a 200 response, so be sure to modify your catchall route to return a 404 instead:
```tsx filename=app/routes/$.tsx
export async function loader() {
  return data({}, 404);
}
```
## Escaping Special Characters
If you want one of the special characters used for these route conventions to actually be a part of the URL, you can escape the conventions with `[]` characters. This can be especially helpful for [resource routes][resource_routes] that include an extension in the URL.
| Filename                            | URL                 |
| ----------------------------------- | ------------------- |
| `app/routes/sitemap[.]xml.tsx`      | `/sitemap.xml`      |
| `app/routes/[sitemap.xml].tsx`      | `/sitemap.xml`      |
| `app/routes/weird-url.[_index].tsx` | `/weird-url/_index` |
| `app/routes/dolla-bills-[$].tsx`    | `/dolla-bills-$`    |
| `app/routes/[[so-weird]].tsx`       | `/[so-weird]`       |
| `app/routes/reports.$id[.pdf].ts`   | `/reports/123.pdf`  |
## Folders for Organization
Routes can also be folders with a `route.tsx` file inside defining the route module. The rest of the files in the folder will not become routes. This allows you to organize your code closer to the routes that use them instead of repeating the feature names across other folders.
The files inside a folder have no meaning for the route paths, the route path is completely defined by the folder name.
Consider these routes:
```text
 app/
├── routes/
│   ├── _landing._index.tsx
│   ├── _landing.about.tsx
│   ├── _landing.tsx
│   ├── app._index.tsx
│   ├── app.projects.tsx
│   ├── app.tsx
│   └── app_.projects.$id.roadmap.tsx
└── root.tsx
```
Some, or all of them can be folders holding their own `route` module inside.
```text
app/
├── routes/
│   ├── _landing._index/
│   │   ├── route.tsx
│   │   └── scroll-experience.tsx
│   ├── _landing.about/
│   │   ├── employee-profile-card.tsx
│   │   ├── get-employee-data.server.ts
│   │   ├── route.tsx
│   │   └── team-photo.jpg
│   ├── _landing/
│   │   ├── footer.tsx
│   │   ├── header.tsx
│   │   └── route.tsx
│   ├── app._index/
│   │   ├── route.tsx
│   │   └── stats.tsx
│   ├── app.projects/
│   │   ├── get-projects.server.ts
│   │   ├── project-buttons.tsx
│   │   ├── project-card.tsx
│   │   └── route.tsx
│   ├── app/
│   │   ├── footer.tsx
│   │   ├── primary-nav.tsx
│   │   └── route.tsx
│   ├── app_.projects.$id.roadmap/
│   │   ├── chart.tsx
│   │   ├── route.tsx
│   │   └── update-timeline.server.ts
│   └── contact-us.tsx
└── root.tsx
```
Note that when you turn a route module into a folder, the route module becomes `folder/route.tsx`, all other modules in the folder will not become routes. For example:
```
# these are the same route:
app/routes/app.tsx
app/routes/app/route.tsx
# as are these
app/routes/app._index.tsx
app/routes/app._index/route.tsx
```
[route-config-file]: ../start/framework/routing#configuring-routes
[loaders]: ../start/framework/data-loading
[actions]: ../start/framework/actions
[routing_guide]: ../start/framework/routing
[root_route]: ../start/framework/route-module
[index_route]: ../start/framework/routing#index-routes
[nested_routing]: ../start/framework/routing#nested-routes
[nested_routes]: #nested-routes
[dot_delimiters]: #dot-delimiters
[dynamic_segments]: #dynamic-segments
[resource_routes]: ../how-to/resource-routes

---

## Page 145 — `docs/how-to/file-uploads.md`

Live URL: https://reactrouter.com/how-to/file-uploads

# File Uploads
[MODES: framework]
<br/>
<br/>
_Thank you to David Adams for [writing an original guide](https://programmingarehard.com/2024/09/06/remix-file-uploads-updated.html/) on which this doc is based. You can refer to it for even more examples._
## Basic File Upload
### 1. Setup some routes
You can setup your routes however you like. This example uses the following structure:
```ts filename=routes.ts
export default [
  // ... other routes
  route("user/:id", "pages/user-profile.tsx", [
    route("avatar", "api/avatar.tsx"),
  ]),
] satisfies RouteConfig;
```
### 2. Add the form data parser
`form-data-parser` is a wrapper around `request.formData()` that provides streaming support for handling file uploads.
```shellscript
npm i @remix-run/form-data-parser
```
[See the `form-data-parser` docs for more information][form-data-parser]
### 3. Create a route with an upload action
The `parseFormData` function takes an `uploadHandler` function as an argument. This function will be called for each file upload in the form.
<docs-warning>
You must set the form's `enctype` to `multipart/form-data` for file uploads to work.
</docs-warning>
```tsx filename=pages/user-profile.tsx
export async function action({
  request,
}: Route.ActionArgs) {
  const uploadHandler = async (fileUpload: FileUpload) => {
    if (fileUpload.fieldName === "avatar") {
      // process the upload and return a File
    }
  };
  const formData = await parseFormData(
    request,
    uploadHandler,
  );
  // 'avatar' has already been processed at this point
  const file = formData.get("avatar");
}
export default function Component() {
  return (
    <form method="post" encType="multipart/form-data">
      <input type="file" name="avatar" />
      <button>Submit</button>
    </form>
  );
}
```
## Local Storage Implementation
### 1. Add the storage package
`file-storage` is a key/value interface for storing [File objects][file] in JavaScript. Similar to how `localStorage` allows you to store key/value pairs of strings in the browser, file-storage allows you to store key/value pairs of files on the server.
```shellscript
npm i @remix-run/file-storage
```
[See the `file-storage` docs for more information][file-storage]
### 2. Create a storage configuration
Create a file that exports a `LocalFileStorage` instance to be used by different routes.
```ts filename=avatar-storage.server.ts
export function getStorageKey(userId: string) {
  return `user-${userId}-avatar`;
}
```
### 3. Implement the upload handler
Update the form's `action` to store files in the `fileStorage` instance.
```tsx filename=pages/user-profile.tsx
export async function action({
  request,
  params,
}: Route.ActionArgs) {
  async function uploadHandler(fileUpload: FileUpload) {
    if (
      fileUpload.fieldName === "avatar" &&
      fileUpload.type.startsWith("image/")
    ) {
      let storageKey = getStorageKey(params.id);
      // FileUpload objects are not meant to stick around for very long (they are
      // streaming data from the request.body); store them as soon as possible.
      await fileStorage.set(storageKey, fileUpload);
      // Return a File for the FormData object. This is a LazyFile that knows how
      // to access the file's content if needed (using e.g. file.stream()) but
      // waits until it is requested to actually read anything.
      return fileStorage.get(storageKey);
    }
  }
  const formData = await parseFormData(
    request,
    uploadHandler,
  );
}
export default function UserPage({
  actionData,
  params,
}: Route.ComponentProps) {
  return (
    <div>
      <h1>User {params.id}</h1>
      <form
        method="post"
        // The form's enctype must be set to "multipart/form-data" for file uploads
        encType="multipart/form-data"
      >
        <input type="file" name="avatar" accept="image/*" />
        <button>Submit</button>
      </form>
      <img
        src={`/user/${params.id}/avatar`}
        alt="user avatar"
      />
    </div>
  );
}
```
### 4. Add a route to serve the uploaded file
Create a [resource route][resource-route] that streams the file as a response.
```tsx filename=api/avatar.tsx
export async function loader({ params }: Route.LoaderArgs) {
  const storageKey = getStorageKey(params.id);
  const file = await fileStorage.get(storageKey);
  if (!file) {
    throw new Response("User avatar not found", {
      status: 404,
    });
  }
  return new Response(file.stream(), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename=${file.name}`,
    },
  });
}
```
[form-data-parser]: https://www.npmjs.com/package/@remix-run/form-data-parser
[file-storage]: https://www.npmjs.com/package/@remix-run/file-storage
[file]: https://developer.mozilla.org/en-US/docs/Web/API/File
[resource-route]: ../how-to/resource-routes

---

## Page 146 — `docs/how-to/form-validation.md`

Live URL: https://reactrouter.com/how-to/form-validation

# Form Validation
[MODES: framework, data]
<br/>
<br/>
This guide walks through a simple signup form implementation. You will likely want to pair these concepts with third-party validation libraries and error components, but this guide only focuses on the moving pieces for React Router.
## 1. Setting Up
We'll start by creating a basic signup route with form.
```ts filename=app/routes.ts
export default [
  route("signup", "signup.tsx"),
] satisfies RouteConfig;
```
```tsx filename=signup.tsx
export default function Signup(_: Route.ComponentProps) {
  let fetcher = useFetcher();
  return (
    <fetcher.Form method="post">
      <p>
        <input type="email" name="email" />
      </p>
      <p>
        <input type="password" name="password" />
      </p>
      <button type="submit">Sign Up</button>
    </fetcher.Form>
  );
}
```
## 2. Defining the Action
In this step, we'll define a server `action` in the same file as our `Signup` component. Note that the aim here is to provide a broad overview of the mechanics involved rather than digging deep into form validation rules or error object structures. We'll use rudimentary checks for the email and password to demonstrate the core concepts.
```tsx filename=signup.tsx
export default function Signup(_: Route.ComponentProps) {
  // omitted for brevity
}
export async function action({
  request,
}: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const errors = {};
  if (!email.includes("@")) {
    errors.email = "Invalid email address";
  }
  if (password.length < 12) {
    errors.password =
      "Password should be at least 12 characters";
  }
  if (Object.keys(errors).length > 0) {
    return data({ errors }, { status: 400 });
  }
  // Redirect to dashboard if validation is successful
  return redirect("/dashboard");
}
```
If any validation errors are found, they are returned from the `action` to the fetcher. This is our way of signaling to the UI that something needs to be corrected, otherwise the user will be redirected to the dashboard.
Note the `data({ errors }, { status: 400 })` call. Setting a 400 status is the web standard way to signal to the client that there was a validation error (Bad Request). In React Router, only 2xx status codes trigger page data revalidation, so sending a 400 status prevents the normal revalidation that would occur after an `action`.
## 3. Displaying Validation Errors
Finally, we'll modify the `Signup` component to display validation errors, if any, from `fetcher.data`.
```tsx filename=signup.tsx lines=[3,8,13-15]
export default function Signup(_: Route.ComponentProps) {
  let fetcher = useFetcher();
  let errors = fetcher.data?.errors;
  return (
    <fetcher.Form method="post">
      <p>
        <input type="email" name="email" />
        {errors?.email ? <em>{errors.email}</em> : null}
      </p>
      <p>
        <input type="password" name="password" />
        {errors?.password ? (
          <em>{errors.password}</em>
        ) : null}
      </p>
      <button type="submit">Sign Up</button>
    </fetcher.Form>
  );
}
```

---

## Page 147 — `docs/how-to/headers.md`

Live URL: https://reactrouter.com/how-to/headers

# HTTP Headers
[MODES: framework]
<br/>
<br/>
## Reading request headers
The `request` sent to route handlers is a standard Web Fetch [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request), so you can read headers directly from the [`request.headers`](https://developer.mozilla.org/en-US/docs/Web/API/Request/headers) property:
```tsx filename=some-route.tsx
export async function loader({
  request,
}: Route.LoaderArgs) {
  // Standard Headers methods are available
  const userAgent = request.headers.get("User-Agent");
  const hasCookies = request.headers.has("Cookie");
  // ...
}
```
## Setting response headers
Headers are primarily defined with the route module `headers` export. You can also set headers in `entry.server.tsx`.
### From Route Modules
```tsx filename=some-route.tsx
export function headers(_: Route.HeadersArgs) {
  return {
    "Content-Security-Policy": "default-src 'self'",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "max-age=3600, s-maxage=86400",
  };
}
```
You can return either a [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) instance or `HeadersInit`.
### From loaders and actions
When the header is dependent on loader data, loaders and actions can also set headers.
**1. Wrap your return value in `data`**
```tsx lines=[1,8]
export async function loader({ params }: LoaderArgs) {
  let [page, ms] = await fakeTimeCall(
    await getPage(params.id),
  );
  return data(page, {
    headers: {
      "Server-Timing": `page;dur=${ms};desc="Page query"`,
    },
  });
}
```
**2. Return from `headers` export**
Headers from loaders and actions are not sent automatically. You must explicitly return them from the `headers` export.
```tsx
function hasAnyHeaders(headers: Headers): boolean {
  return [...headers].length > 0;
}
export function headers({
  actionHeaders,
  loaderHeaders,
}: HeadersArgs) {
  return hasAnyHeaders(actionHeaders)
    ? actionHeaders
    : loaderHeaders;
}
```
One notable exception is `Set-Cookie` headers, which are automatically preserved from `headers`, `loader`, and `action` in parent routes, even without exporting `headers` from the child route.
### Merging with parent headers
Consider these nested routes
```ts filename=routes.ts
route("pages", "pages-layout-with-nav.tsx", [
  route(":slug", "page.tsx"),
]);
```
If both route modules want to set headers, the headers from the deepest matching route will be sent.
When you need to keep both the parent and the child headers, you need to merge them in the child route.
#### Appending
The easiest way is to simply append to the parent headers. This avoids overwriting a header the parent may have set and both are important.
```tsx
export function headers({ parentHeaders }: HeadersArgs) {
  parentHeaders.append(
    "Permissions-Policy: geolocation=()",
  );
  return parentHeaders;
}
```
#### Setting
Sometimes it's important to overwrite the parent header. Do this with `set` instead of `append`:
```tsx
export function headers({ parentHeaders }: HeadersArgs) {
  parentHeaders.set(
    "Cache-Control",
    "max-age=3600, s-maxage=86400",
  );
  return parentHeaders;
}
```
You can avoid the need to merge headers by only defining headers in "leaf routes" (index routes and child routes without children) and not in parent routes.
### From `entry.server.tsx`
The `handleRequest` export receives the headers from the route module as an argument. You can append global headers here.
```tsx
export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  routerContext,
  loadContext,
) {
  // set, append global headers
  responseHeaders.set(
    "X-App-Version",
    routerContext.manifest.version,
  );
  return new Response(await getStream(), {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
```
If you don't have an `entry.server.tsx` run the `reveal` command:
```shellscript nonumber
react-router reveal
```

---

## Page 148 — `docs/how-to/index.md`

Live URL: https://reactrouter.com/how-to/index



---

## Page 149 — `docs/how-to/instrumentation.md`

Live URL: https://reactrouter.com/how-to/instrumentation

# Instrumentation
[MODES: framework, data]
<br/>
<br/>
Instrumentation allows you to add logging, error reporting, and performance tracing to your React Router application without modifying your actual route handlers. This enables comprehensive observability solutions for production applications on both the server and client.
## Overview
With the React Router Instrumentation APIs, you provide "wrapper" functions that execute around your request handlers, router operations, route middlewares, and/or route handlers. This allows you to:
- Monitor application performance
- Add logging
- Integrate with observability platforms (Sentry, DataDog, New Relic, etc.)
- Implement OpenTelemetry tracing
- Track user behavior and navigation patterns
A key design principle is that instrumentation is **read-only** - you can observe what's happening but cannot modify runtime application behavior by modifying the arguments passed to, or data returned from your route handlers.
<docs-info>
As with any instrumentation approach, adding additional code execution at runtime may alter the performance characteristics compared to an uninstrumented application. Keep this in mind and perform appropriate testing and/or leverage conditional instrumentation to avoid a negative UX impact in production.
</docs-info>
## Quick Start (Framework Mode)
[modes: framework]
### 1. Server-side Instrumentation
Add instrumentations to your `entry.server.tsx`:
```tsx filename=app/entry.server.tsx
          console.log(`Request start: ${url}`);
          await handleRequest();
          console.log(`Request end: ${url}`);
        },
      });
    },
    // Instrument individual routes
    route(route) {
      // Skip instrumentation for specific routes if needed
      if (route.id === "root") return;
      route.instrument({
        async loader(callLoader, { request }) {
          let url = `${request.method} ${request.url}`;
          console.log(`Loader start: ${url} - ${route.id}`);
          await callLoader();
          console.log(`Loader end: ${url} - ${route.id}`);
        },
        // Other available instrumentations:
        // async action() { /* ... */ },
        // async middleware() { /* ... */ },
        // async lazy() { /* ... */ },
      });
    },
  },
];
export default function handleRequest(/* ... */) {
  // Your existing handleRequest implementation
}
```
### 2. Client-side Instrumentation
Add instrumentations to your `entry.client.tsx`:
```tsx filename=app/entry.client.tsx
const instrumentations = [
  {
    // Instrument router operations
    router(router) {
      router.instrument({
        // Instrument navigations
        async navigate(callNavigate, { currentUrl, to }) {
          let nav = `${currentUrl} → ${to}`;
          console.log(`Navigation start: ${nav}`);
          await callNavigate();
          console.log(`Navigation end: ${nav}`);
        },
        // Instrument fetcher calls
        async fetch(
          callFetch,
          { href, currentUrl, fetcherKey },
        ) {
          let fetch = `${fetcherKey} → ${href}`;
          console.log(`Fetcher start: ${fetch}`);
          await callFetch();
          console.log(`Fetcher end: ${fetch}`);
        },
      });
    },
    // Instrument individual routes (same as server-side)
    route(route) {
      // Skip instrumentation for specific routes if needed
      if (route.id === "root") return;
      route.instrument({
        async loader(callLoader, { request }) {
          let url = `${request.method} ${request.url}`;
          console.log(`Loader start: ${url} - ${route.id}`);
          await callLoader();
          console.log(`Loader end: ${url} - ${route.id}`);
        },
        // Other available instrumentations:
        // async action() { /* ... */ },
        // async middleware() { /* ... */ },
        // async lazy() { /* ... */ },
      });
    },
  },
];
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter instrumentations={instrumentations} />
    </StrictMode>,
  );
});
```
## Quick Start (Data Mode)
[modes: data]
In Data Mode, you add instrumentations when creating your router:
```tsx
const instrumentations = [
  {
    // Instrument router operations
    router(router) {
      router.instrument({
        // Instrument navigations
        async navigate(callNavigate, { currentUrl, to }) {
          let nav = `${currentUrl} → ${to}`;
          console.log(`Navigation start: ${nav}`);
          await callNavigate();
          console.log(`Navigation end: ${nav}`);
        },
        // Instrument fetcher calls
        async fetch(
          callFetch,
          { href, currentUrl, fetcherKey },
        ) {
          let fetch = `${fetcherKey} → ${href}`;
          console.log(`Fetcher start: ${fetch}`);
          await callFetch();
          console.log(`Fetcher end: ${fetch}`);
        },
      });
    },
    // Instrument individual routes (same as server-side)
    route(route) {
      // Skip instrumentation for specific routes if needed
      if (route.id === "root") return;
      route.instrument({
        async loader(callLoader, { request }) {
          let url = `${request.method} ${request.url}`;
          console.log(`Loader start: ${url} - ${route.id}`);
          await callLoader();
          console.log(`Loader end: ${url} - ${route.id}`);
        },
        // Other available instrumentations:
        // async action() { /* ... */ },
        // async middleware() { /* ... */ },
        // async lazy() { /* ... */ },
      });
    },
  },
];
const router = createBrowserRouter(routes, {
  instrumentations,
});
function App() {
  return <RouterProvider router={router} />;
}
```
## Core Concepts
### Instrumentation Levels
There are different levels at which you can instrument your application. Each instrumentation function receives a second "info" parameter containing relevant contextual information for the specific aspect being instrumented.
#### 1. Handler Level (Server)
[modes: framework]
Instruments the top-level request handler that processes all requests to your server:
```tsx filename=entry.server.tsx
        },
      });
    },
  },
];
```
#### 2. Router Level (Client)
[modes: framework,data]
Instruments client-side router operations like navigations and fetcher calls:
```tsx
        },
        async fetch(
          callFetch,
          { href, currentUrl, fetcherKey },
        ) {
          // Runs around fetcher operations
          await callFetch();
        },
      });
    },
  },
];
// Framework Mode (entry.client.tsx)
<HydratedRouter instrumentations={instrumentations} />;
// Data Mode
const router = createBrowserRouter(routes, {
  instrumentations,
});
```
#### 3. Route Level (Server + Client)
[modes: framework,data]
Instruments individual route handlers:
```tsx
const instrumentations = [
  {
    route(route) {
      route.instrument({
        async loader(
          callLoader,
          { params, request, context, pattern },
        ) {
          // Runs around loader execution
          await callLoader();
        },
        async action(
          callAction,
          { params, request, context, pattern },
        ) {
          // Runs around action execution
          await callAction();
        },
        async middleware(
          callMiddleware,
          { params, request, context, pattern },
        ) {
          // Runs around middleware execution
          await callMiddleware();
        },
        async lazy(callLazy) {
          // Runs around lazy route loading
          await callLazy();
        },
      });
    },
  },
];
```
### Read-only Design
Instrumentations are designed to be **observational only**. You cannot:
- Modify arguments passed to handlers
- Change return values from handlers
- Alter application behavior
This ensures that instrumentation is safe to add to production applications and cannot introduce bugs in your route logic.
### Error Handling
To ensure that instrumentation code doesn't impact the runtime application, errors are caught internally and prevented from propagating outward. This design choice shows up in 2 aspects.
First, if a "handler" function (loader, action, request handler, navigation, etc.) throws an error, that error will not bubble out of the `callHandler` function invoked from your instrumentation. Instead, the `callHandler` function returns a discriminated union result of type `{ type: "success", error: undefined } | { type: "error", error: unknown }`. This ensures your entire instrumentation function runs without needing any try/catch/finally logic to handle application errors.
```tsx
          if (status === "error") {
            // error case - `error` is defined
          } else {
            // success case - `error` is undefined
          }
        },
      });
    },
  },
];
```
Second, if your instrumentation function throws an error, React Router will gracefully swallow that so that it does not bubble outward and impact other instrumentations or application behavior. In both of these examples, the handlers and all other instrumentation functions will still run:
```tsx
          await callLoader();
        },
        // Throwing after calling the handler - RR will
        // catch the error internally
        async action(callAction) {
          await callAction();
          somethingThatThrows();
        },
      });
    },
  },
];
```
### Composition
You can compose multiple instrumentations by providing an array:
```tsx
```
Each instrumentation wraps the previous one, creating a nested execution chain.
### Conditional Instrumentation
You can enable instrumentation conditionally based on environment or other factors:
```tsx
```
```tsx
// Or conditionally within an instrumentation
      // Or, only instrument if a query parameter is present
      let sp = new URL(request.url).searchParams;
      if (!sp.has("DEBUG")) return;
      route.instrument({
        async loader() {
          /* ... */
        },
      });
    },
  },
];
```
## Common Patterns
### Request logging (server)
```tsx
const logging: ServerInstrumentation = {
  handler({ instrument }) {
    instrument({
      request: (fn, { request }) =>
        log(`request ${request.url}`, fn),
    });
  },
  route({ instrument, id }) {
    instrument({
      middleware: (fn) => log(` middleware (${id})`, fn),
      loader: (fn) => log(`  loader (${id})`, fn),
      action: (fn) => log(`  action (${id})`, fn),
    });
  },
};
async function log(
  label: string,
  cb: () => Promise<InstrumentationHandlerResult>,
) {
  let start = Date.now();
  console.log(`➡️ ${label}`);
  await cb();
  console.log(`⬅️ ${label} (${Date.now() - start}ms)`);
}
```
### OpenTelemetry Integration
```tsx
const tracer = trace.getTracer("my-app");
const otel: ServerInstrumentation = {
  handler({ instrument }) {
    instrument({
      request: (fn, { request }) =>
        otelSpan(`request`, { url: request.url }, fn),
    });
  },
  route({ instrument, id }) {
    instrument({
      middleware: (fn, { pattern }) =>
        otelSpan(
          "middleware",
          { routeId: id, pattern: pattern },
          fn,
        ),
      loader: (fn, { pattern }) =>
        otelSpan(
          "loader",
          { routeId: id, pattern: pattern },
          fn,
        ),
      action: (fn, { pattern }) =>
        otelSpan(
          "action",
          { routeId: id, pattern: pattern },
          fn,
        ),
    });
  },
};
async function otelSpan(
  label: string,
  attributes: Record<string, string>,
  cb: () => Promise<InstrumentationHandlerResult>,
) {
  return tracer.startActiveSpan(
    label,
    { attributes },
    async (span) => {
      let { error } = await cb();
      if (error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
        });
      }
      span.end();
    },
  );
}
```
### Client-side Performance Tracking
```tsx
const windowPerf: ClientInstrumentation = {
  router({ instrument }) {
    instrument({
      navigate: (fn, { to, currentUrl }) =>
        measure(`navigation:${currentUrl}->${to}`, fn),
      fetch: (fn, { href }) =>
        measure(`fetcher:${href}`, fn),
    });
  },
  route({ instrument, id }) {
    instrument({
      middleware: (fn) => measure(`middleware:${id}`, fn),
      loader: (fn) => measure(`loader:${id}`, fn),
      action: (fn) => measure(`action:${id}`, fn),
    });
  },
};
async function measure(
  label: string,
  cb: () => Promise<InstrumentationHandlerResult>,
) {
  performance.mark(`start:${label}`);
  await cb();
  performance.mark(`end:${label}`);
  performance.measure(
    label,
    `start:${label}`,
    `end:${label}`,
  );
}
<HydratedRouter instrumentations={[windowPerf]} />;
```

---

## Page 150 — `docs/how-to/meta.md`

Live URL: https://reactrouter.com/how-to/meta

[copy pasted from route module doc]
By default, meta descriptors will render a [`<meta>` tag][meta-element] in most cases. The two exceptions are:
- `{ title }` renders a `<title>` tag
- `{ "script:ld+json" }` renders a `<script type="application/ld+json">` tag, and its value should be a serializable object that is stringified and injected into the tag.
```tsx
export function meta() {
  return [
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "React Router",
        url: "https://reactrouter.com",
      },
    },
  ];
}
```
A meta descriptor can also render a [`<link>` tag][link-element] by setting the `tagName` property to `"link"`. This is useful for `<link>` tags associated with SEO like `canonical` URLs. For asset links like stylesheets and favicons, you should use the [`links` export][links] instead.
```tsx
export function meta() {
  return [
    {
      tagName: "link",
      rel: "canonical",
      href: "https://reactrouter.com",
    },
  ];
}
```

---

## Page 151 — `docs/how-to/middleware.md`

Live URL: https://reactrouter.com/how-to/middleware

# Middleware
[MODES: framework, data]
<br/>
<br/>
Middleware allows you to run code before and after the [`Response`][Response] generation for the matched path. This enables [common patterns][common-patterns] like authentication, logging, error handling, and data preprocessing in a reusable way.
Middleware runs in a nested chain, executing from parent routes to child routes on the way "down" to your route handlers, then from child routes back to parent routes on the way "up" after a [`Response`][Response] is generated.
For example, on a `GET /parent/child` request, the middleware would run in the following order:
```text
- Root middleware start
  - Parent middleware start
    - Child middleware start
      - Run loaders, generate HTML Response
    - Child middleware end
  - Parent middleware end
- Root middleware end
```
<docs-info>There are some slight differences between middleware on the server (framework mode) versus the client (framework/data mode). For the purposes of this document, we'll be referring to Server Middleware in most of our examples as it's the most familiar to users who've used middleware in other HTTP servers in the past. Please refer to the [Server vs Client Middleware][server-client] section below for more information.</docs-info>
## Quick Start (Framework mode)
### 1. Enable the middleware flag
First, enable middleware in your [React Router config][rr-config]:
```ts filename=react-router.config.ts
export default {
  future: {
    v8_middleware: true,
  },
} satisfies Config;
```
<docs-warning>By enabling the middleware feature, you change the type of the `context` parameter to your [`action`][framework-action]s and [`loader`][framework-loader]s. Please pay attention to the section on [`getLoadContext`][getloadcontext] below if you are actively using `context` today.</docs-warning>
### 2. Create a context
Middleware uses a `context` provider instance to provide data down the middleware chain.
You can create type-safe context objects using [`createContext`][createContext]:
```ts filename=app/context.ts
```
### 3. Export middleware from your routes
```tsx filename=app/routes/dashboard.tsx
// Server-side Authentication Middleware
async function authMiddleware({ request, context }) {
  const user = await getUserFromSession(request);
  if (!user) {
    throw redirect("/login");
  }
  context.set(userContext, user);
}
export const middleware: Route.MiddlewareFunction[] = [
  authMiddleware,
];
// Client-side timing middleware
async function timingMiddleware({ context }, next) {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  console.log(`Navigation took ${duration}ms`);
}
export const clientMiddleware: Route.ClientMiddlewareFunction[] =
  [timingMiddleware];
export async function loader({
  context,
}: Route.LoaderArgs) {
  const user = context.get(userContext);
  const profile = await getProfile(user);
  return { profile };
}
export default function Dashboard({
  loaderData,
}: Route.ComponentProps) {
  return (
    <div>
      <h1>Welcome {loaderData.profile.fullName}!</h1>
      <Profile profile={loaderData.profile} />
    </div>
  );
}
```
### 4. Update your `getLoadContext` function (if applicable)
If you're using a custom server and a `getLoadContext` function, you will need to update your implementation to return an instance of [`RouterContextProvider`][RouterContextProvider], instead of a JavaScript object:
```diff
+import {
+  createContext,
+  RouterContextProvider,
+} from "react-router";
+const dbContext = createContext<Database>();
function getLoadContext(req, res) {
-  return { db: createDb() };
+  const context = new RouterContextProvider();
+  context.set(dbContext, createDb());
+  return context;
}
```
## Quick Start (Data Mode)
### 1. TypeScript: augment `Future` for loader/action `context`
In order to properly type your `context` param in your `loader`/`action`/`middleware` functions, you will need a small module augmentation to override the default context type of `any`:
```ts
// src/react-router.d.ts
declare module "react-router" {
  interface Future {
    v8_middleware: true;
  }
}
```
Without this, `context` stays loosely typed even when middleware is enabled at runtime.
### 2. Create a context
Middleware uses a `context` provider to pass data through the middleware chain into loaders and actions. Create typed context with [`createContext`][createContext]:
```ts
```
### 3. Add `middleware` to route objects
Attach `middleware` arrays to your route objects:
```tsx
const routes = [
  {
    path: "/",
    middleware: [timingMiddleware], // 👈
    Component: Root,
    children: [
      {
        path: "dashboard",
        middleware: [authMiddleware], // 👈
        loader: dashboardLoader,
        Component: Dashboard,
      },
      {
        path: "login",
        Component: Login,
      },
    ],
  },
];
async function timingMiddleware({ context }, next) {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  console.log(`Navigation took ${duration}ms`);
}
async function authMiddleware({ context }) {
  const user = await getUser();
  if (!user) {
    throw redirect("/login");
  }
  context.set(userContext, user);
}
export async function dashboardLoader({
  context,
}: LoaderFunctionArgs) {
  const user = context.get(userContext);
  const profile = await getProfile(user);
  return { profile };
}
export default function Dashboard() {
  let loaderData = useLoaderData();
  return (
    <div>
      <h1>Welcome {loaderData.profile.fullName}!</h1>
      <Profile profile={loaderData.profile} />
    </div>
  );
}
```
### 4. Add a `getContext` function (optional)
To seed every navigation or fetcher call with shared values, pass [`getContext`][getContext] when creating the router:
```tsx
let sessionContext = createContext();
const router = createBrowserRouter(routes, {
  getContext() {
    let context = new RouterContextProvider();
    context.set(sessionContext, getSession());
    return context;
  },
});
```
<docs-info>This mirrors Framework mode’s server-side [`getLoadContext`][getloadcontext]. In the browser, root `middleware` can often do the same job, but `getContext` is available when you want to seed every request up front.</docs-info>
## Core Concepts
### Server vs Client Middleware
Server middleware runs on the server in Framework mode for HTML Document requests and `.data` requests for subsequent navigations and fetcher calls. Because server middleware runs on the server in response to an HTTP [`Request`][request], it returns an HTTP [`Response`][Response] back up the middleware chain via the `next` function:
```ts
async function serverMiddleware({ request }, next) {
  console.log(request.method, request.url);
  let response = await next();
  console.log(response.status, request.method, request.url);
  return response;
}
// Framework mode only
export const middleware: Route.MiddlewareFunction[] = [
  serverMiddleware,
];
```
Client middleware runs in the browser in framework and data mode for client-side navigations and fetcher calls. Client middleware differs from server middleware because there's no HTTP Request, so it doesn't have a `Response` to bubble up. In most cases, you can just ignore the return value from `next` and return nothing from your middleware on the client:
```ts
async function clientMiddleware({ request }, next) {
  console.log(request.method, request.url);
  await next();
  console.log(`Finished ${request.method} ${request.url}`);
}
// Framework mode
export const clientMiddleware: Route.ClientMiddlewareFunction[] =
  [clientMiddleware];
// Or, Data mode
const route = {
  path: "/",
  middleware: [clientMiddleware],
  loader: rootLoader,
  Component: Root,
};
```
There may be _some_ cases where you want to do some post-processing based on the result of the loaders/action. In lieu of a `Response`, client middleware bubbles up the value returned from the active [`dataStrategy`][datastrategy] (`Record<string, DataStrategyResult>` - keyed by route id). This allows you to take conditional action in your middleware based on the outcome of the executed `loader`/`action` functions.
Here's an example of the [CMS Redirect on 404][cms-redirect] use case implemented as a client side middleware:
```tsx
async function cmsFallbackMiddleware({ request }, next) {
  const results = await next();
  // Check if we got a 404 from any of our routes and if so, look for a
  // redirect in our CMS
  const found404 = Object.values(results).some(
    (r) =>
      isRouteErrorResponse(r.result) &&
      r.result.status === 404,
  );
  if (found404) {
    const cmsRedirect = await checkCMSRedirects(
      request.url,
    );
    if (cmsRedirect) {
      throw redirect(cmsRedirect, 302);
    }
  }
}
```
<docs-warning>In a server middleware, you shouldn't be messing with the `Response` body and should only be reading status/headers and setting headers. Similarly, this value should be considered read-only in client middleware because it represents the "body" or "data" for the resulting navigation which should be driven by loaders/actions - not middleware. This also means that in client middleware, there's usually no need to return the results even if you needed to capture it from `await next()`;</docs-warning>
### When Middleware Runs
It is very important to understand _when_ your middlewares will run to make sure your application is behaving as you intend.
#### Server Middleware
In a hydrated Framework Mode app, server middleware is designed such that it prioritizes SPA behavior and does not create new network activity by default. Middleware wraps _existing_ requests and only runs when you _need_ to hit the server.
This raises the question of what is a "handler" in React Router? Is it the route? Or the `loader`? We think "it depends":
- On document requests (`GET /route`), the handler is the route — because the response encompasses both the `loader` and the route component
- On data requests (`GET /route.data`) for client-side navigations, the handler is the [`action`][data-action]/[`loader`][data-loader], because that's all that is included in the response
Therefore:
- Document requests run server middleware whether `loader`s exist or not because we're still in a "handler" to render the UI
- Client-side navigations will only run server middleware if a `.data` request is made to the server for a [`action`][framework-action]/[`loader`][framework-loader]
This is important behavior for request-annotation middlewares such as logging request durations, checking/setting sessions, setting outgoing caching headers, etc. It would be useless to go to the server and run those types of middlewares when there was no reason to go to the server in the first place. This would result in increased server load and noisy server logs.
```tsx filename=app/root.tsx
// This middleware won't run on client-side navigations without a `.data` request
async function loggingMiddleware({ request }, next) {
  console.log(`Request: ${request.method} ${request.url}`);
  let response = await next();
  console.log(
    `Response: ${response.status} ${request.method} ${request.url}`,
  );
  return response;
}
export const middleware: Route.MiddlewareFunction[] = [
  loggingMiddleware,
];
```
However, there may be cases where you _want_ to run certain server middlewares on _every_ client-navigation - even if no `loader` exists. For example, a form in the authenticated section of your site that doesn't require a `loader` but you'd rather use auth middleware to redirect users away before they fill out the form — rather than when they submit to the `action`. If your middleware meets these criteria, then you can put a `loader` on the route that contains the middleware to force it to always call the server for client-side navigations involving that route.
```tsx filename=app/_auth.tsx
function authMiddleware({ request }, next) {
  if (!isLoggedIn(request)) {
    throw redirect("/login");
  }
}
export const middleware: Route.MiddlewareFunction[] = [
  authMiddleware,
];
// By adding a `loader`, we force the `authMiddleware` to run on every
// client-side navigation involving this route.
export async function loader() {
  return null;
}
```
#### Client Middleware
Client middleware is simpler because since we are already on the client and are always making a "request" to the router when navigating. Client middlewares will run on every client navigation, regardless of whether there are `loader`s to run.
### Context API
The new context system provides type safety and prevents naming conflicts and allows you to provide data to nested middlewares and `action`/`loader` functions. In Framework Mode, this replaces the previous `AppLoadContext` API.
```ts
// ✅ Type-safe
const userContext = createContext<User>();
// Later in middleware/`loader`s
context.set(userContext, user); // Must be `User` type
const user = context.get(userContext); // Returns `User` type
// ❌ Old way (no type safety)
context.user = user; // Could be anything
```
#### `Context` and `AsyncLocalStorage`
Node provides an [`AsyncLocalStorage`][asynclocalstorage] API which gives you a way to provide values through asynchronous execution contexts. While this is a Node API, most modern runtimes have made it (mostly) available (i.e., [Cloudflare][cloudflare], [Bun][bun], [Deno][deno]).
In theory, we could have leveraged [`AsyncLocalStorage`][asynclocalstorage] directly as the way to pass values from middlewares to child routes, but the lack of 100% cross-platform compatibility was concerning enough that we wanted to still ship a first-class `context` API so there would be a way to publish reusable middleware packages guaranteed to work in a runtime-agnostic manner.
That said, this API still works great with React Router middleware and can be used in place of, or alongside of the `context` API:
<docs-info>[`AsyncLocalStorage`][asynclocalstorage] is _especially_ powerful when using [React Server Components](../how-to/react-server-components) because it allows you to provide information from `middleware` to your Server Components and Server Actions because they run in the same server execution context 🤯</docs-info>
```tsx filename=app/user-context.ts
const USER = new AsyncLocalStorage<User>();
export async function provideUser(
  request: Request,
  cb: () => Promise<Response>,
) {
  let user = await getUser(request);
  return USER.run(user, cb);
}
export function getUser() {
  return USER.getStore();
}
```
```tsx filename=app/root.tsx
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    return provideUser(request, async () => {
      let res = await next();
      return res;
    });
  },
];
```
```tsx filename=app/routes/_index.tsx
export async function loader() {
  let user = getUser();
  //...
}
```
### The `next` function
The `next` function logic depends on which route middleware it's being called from:
- When called from a non-leaf middleware, it runs the next middleware in the chain
- When called from the leaf middleware, it executes any route handlers and generates the resulting [`Response`][Response] for the request
```ts
const middleware = async ({ context }, next) => {
  // Code here runs BEFORE handlers
  console.log("Before");
  const response = await next();
  // Code here runs AFTER handlers
  console.log("After");
  return response; // Optional on client, required on server
};
```
<docs-warning>You can only call `next()` once per middleware. Calling it multiple times will throw an error</docs-warning>
### Skipping `next()`
If you don't need to run code after your handlers, you can skip calling `next()`:
```ts
const authMiddleware = async ({ request, context }) => {
  const user = await getUser(request);
  if (!user) {
    throw redirect("/login");
  }
  context.set(userContext, user);
  // next() is called automatically
};
```
### `next()` and Error Handling
React Router contains built-in error handling via the route [`ErrorBoundary`][ErrorBoundary] export. Just like when a `action`/`loader` throws, if a `middleware` throws it will be caught and handled at the appropriate [`ErrorBoundary`][ErrorBoundary] and a [`Response`][Response] will be returned through the ancestor `next()` call. This means that the `next()` function should never throw and should always return a [`Response`][Response], so you don't need to worry about wrapping it in a try/catch.
This behavior is important to allow middleware patterns such as automatically setting required headers on outgoing responses (i.e., committing a session) from a root `middleware`. If any error from a `middleware` caused `next()` to `throw`, we'd miss the execution of ancestor middlewares on the way out and those required headers wouldn't be set.
```tsx filename=routes/parent.tsx
export const middleware: Route.MiddlewareFunction[] = [
  async (_, next) => {
    let res = await next();
    //  ^ res.status = 500
    // This response contains the ErrorBoundary
    return res;
  },
];
```
```tsx filename=routes/parent.child.tsx
export const middleware: Route.MiddlewareFunction[] = [
  async (_, next) => {
    let res = await next();
    //  ^ res.status = 200
    // This response contains the successful UI render
    throw new Error("Uh oh, something went wrong!");
  },
];
```
Which `ErrorBoundary` is rendered will differ based on whether your middleware threw _before_ or _after_ calling then `next()` function. If it throws _after_ then it will bubble up from the throwing route just like a normal loader error because we've already run the loaders and have the appropriate `loaderData` to render in the route components. However, if an error is thrown _before_ calling `next()`, then we haven't called any loaders yet and there is no `loaderData` available. When this happens, we must bubble up to the highest route with a `loader` and start looking for an `ErrorBoundary` there. We cannot render any route components at that level or below without any `loaderData`.
## Changes to `getLoadContext`/`AppLoadContext`
<docs-info>This only applies if you are using a custom server and a custom `getLoadContext` function</docs-info>
Middleware introduces a breaking change to the `context` parameter generated by `getLoadContext` and passed to your `action`s and `loader`s. The current approach of a module-augmented `AppLoadContext` isn't really type-safe and instead just sort of tells TypeScript to "trust me".
Middleware needs an equivalent `context` on the client for `clientMiddleware`, but we didn't want to duplicate this pattern from the server that we already weren't thrilled with, so we decided to introduce a new API where we could tackle type-safety.
When opting into middleware, the `context` parameter changes to an instance of [`RouterContextProvider`][RouterContextProvider]:
```ts
let dbContext = createContext<Database>();
let context = new RouterContextProvider();
context.set(dbContext, getDb());
//                     ^ type-safe
let db = context.get(dbContext);
//  ^ Database
```
If you're using a custom server and a `getLoadContext` function, you will need to update your implementation to return an instance of [`RouterContextProvider`][RouterContextProvider], instead of a plain JavaScript object:
```diff
+import {
+  createContext,
+  RouterContextProvider,
+} from "react-router";
+const dbContext = createContext<Database>();
function getLoadContext(req, res) {
-  return { db: createDb() };
+  const context = new RouterContextProvider();
+  context.set(dbContext, createDb());
+  return context;
}
```
### Migration from `AppLoadContext`
If you're currently using `AppLoadContext`, you can migrate incrementally by using your existing module augmentation to augment [`RouterContextProvider`][RouterContextProvider] instead of `AppLoadContext`. Then, update your `getLoadContext` function to return an instance of [`RouterContextProvider`][RouterContextProvider]:
```diff
declare module "react-router" {
-  interface AppLoadContext {
+  interface RouterContextProvider {
    db: Database;
    user: User;
  }
}
function getLoadContext() {
  const loadContext = {...};
-  return loadContext;
+  let context = new RouterContextProvider();
+  Object.assign(context, loadContext);
+  return context;
}
```
This allows you to leave your `action`s/`loader`s untouched during initial adoption of middleware, since they can still read values directly (i.e., `context.db`).
<docs-warning>This approach is only intended to be used as a migration strategy when adopting middleware in React Router v7, allowing you to incrementally migrate to `context.set`/`context.get`. It is not safe to assume this approach will work in the next major version of React Router.</docs-warning>
<docs-warning>The [`RouterContextProvider`][RouterContextProvider] class is also used for the client-side `context` parameter via `<HydratedRouter getContext>` and `<RouterProvider getContext>`. Since `AppLoadContext` is primarily intended as a hand-off from your HTTP server into the React Router handlers, you need to be aware that these augmented fields will not be available in `clientMiddleware`, `clientLoader`, or `clientAction` functions even thought TypeScript will tell you they are (unless, of course, you provide the fields via `getContext` on the client).</docs-warning>
## Common Patterns
### Authentication
```tsx filename=app/middleware/auth.ts
  const userId = session.get("userId");
  if (!userId) {
    throw redirect("/login");
  }
  const user = await getUserById(userId);
  context.set(userContext, user);
};
```
```tsx filename=app/routes/protected.tsx
export const middleware: Route.MiddlewareFunction[] = [
  authMiddleware,
];
export async function loader({
  context,
}: Route.LoaderArgs) {
  const user = context.get(userContext); // Guaranteed to exist
  return { user };
}
```
### Logging
```tsx filename=app/middleware/logging.ts
  context.set(requestIdContext, requestId);
  console.log(
    `[${requestId}] ${request.method} ${request.url}`,
  );
  const start = performance.now();
  const response = await next();
  const duration = performance.now() - start;
  console.log(
    `[${requestId}] Response ${response.status} (${duration}ms)`,
  );
  return response;
};
```
### CMS Redirect on 404
```tsx filename=app/middleware/cms-fallback.ts
  // Check if we got a 404
  if (response.status === 404) {
    // Check CMS for a redirect
    const cmsRedirect = await checkCMSRedirects(
      request.url,
    );
    if (cmsRedirect) {
      throw redirect(cmsRedirect, 302);
    }
  }
  return response;
};
```
### Response Headers
```tsx filename=app/middleware/headers.ts
  // Add security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
};
```
### Conditional Middleware
```tsx
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    // Only run auth for POST requests
    if (request.method === "POST") {
      await ensureAuthenticated(request, context);
    }
    return next();
  },
];
```
### Sharing Context Between `action` and `loader`
<docs-info>On the server, this approach only works for document POST requests because `context` is scoped to a request. SPA navigation submissions use separate POST/GET requests so you cannot share `context` between them. This pattern always works in `clientMiddleware`/`clientLoader`/`clientAction` because there's no separate HTTP requests.</docs-info>
```tsx
const sharedDataContext = createContext<any>();
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    // Set data if it doesn't exist
    // This will only run once for document requests
    // It will run twice (action request + loader request) in SPA submissions
    if (!context.get(sharedDataContext)) {
      context.set(
        sharedDataContext,
        await getExpensiveData(),
      );
    }
    return next();
  },
];
export async function action({
  context,
}: Route.ActionArgs) {
  const data = context.get(sharedDataContext);
  // Use the data...
}
export async function loader({
  context,
}: Route.LoaderArgs) {
  const data = context.get(sharedDataContext);
  // Same data is available here
}
```
[future-flags]: ../upgrading/future
[Response]: https://developer.mozilla.org/en-US/docs/Web/API/Response
[common-patterns]: #common-patterns
[server-client]: #server-vs-client-middleware
[rr-config]: ../api/framework-conventions/react-router.config.ts
[create-browser-router]: ../api/data-routers/createBrowserRouter
[create-hash-router]: ../api/data-routers/createHashRouter
[create-memory-router]: ../api/data-routers/createMemoryRouter
[create-static-handler]: ../api/data-routers/createStaticHandler
[framework-action]: ../start/framework/route-module#action
[framework-loader]: ../start/framework/route-module#loader
[getloadcontext]: #changes-to-getloadcontextapploadcontext
[datastrategy]: ../api/data-routers/createBrowserRouter#optsdatastrategy
[cms-redirect]: #cms-redirect-on-404
[createContext]: ../api/utils/createContext
[RouterContextProvider]: ../api/utils/RouterContextProvider
[getContext]: ../api/data-routers/createBrowserRouter#optsgetContext
[window]: https://developer.mozilla.org/en-US/docs/Web/API/Window
[document]: https://developer.mozilla.org/en-US/docs/Web/API/Document
[request]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[data-action]: ../start/data/route-object#action
[data-loader]: ../start/data/route-object#loader
[asynclocalstorage]: https://nodejs.org/api/async_context.html#class-asynclocalstorage
[cloudflare]: https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/
[bun]: https://bun.sh/blog/bun-v0.7.0#asynclocalstorage-support
[deno]: https://docs.deno.com/api/node/async_hooks/~/AsyncLocalStorage
[ErrorBoundary]: ../start/framework/route-module#errorboundary

---

## Page 152 — `docs/how-to/navigation-blocking.md`

Live URL: https://reactrouter.com/how-to/navigation-blocking

# Navigation Blocking
[MODES: framework, data]
<br/>
<br/>
When users are in the middle of a workflow, like filling out an important form, you may want to prevent them from navigating away from the page.
This example will show:
- Setting up a route with a form and action called with a fetcher
- Blocking navigation when the form is dirty
- Showing a confirmation when the user tries to leave the page
## 1. Set up a route with a form
Add a route with the form, we'll use a "contact" route for this example:
```ts filename=routes.ts
export default [
  index("routes/home.tsx"),
  route("contact", "routes/contact.tsx"),
] satisfies RouteConfig;
```
Add the form to the contact route module:
```tsx filename=routes/contact.tsx
export async function action({
  request,
}: Route.ActionArgs) {
  let formData = await request.formData();
  let email = formData.get("email");
  let message = formData.get("message");
  console.log(email, message);
  return { ok: true };
}
export default function Contact() {
  let fetcher = useFetcher();
  return (
    <fetcher.Form method="post">
      <p>
        <label>
          Email: <input name="email" type="email" />
        </label>
      </p>
      <p>
        <textarea name="message" />
      </p>
      <p>
        <button type="submit">
          {fetcher.state === "idle" ? "Send" : "Sending..."}
        </button>
      </p>
    </fetcher.Form>
  );
}
```
## 2. Add dirty state and onChange handler
To track the dirty state of the form, we'll use a single boolean and a quick form onChange handler. You may want to track the dirty state differently but this works for this guide.
```tsx filename=routes/contact.tsx lines=[2,8-12]
export default function Contact() {
  let [isDirty, setIsDirty] = useState(false);
  let fetcher = useFetcher();
  return (
    <fetcher.Form
      method="post"
      onChange={(event) => {
        let email = event.currentTarget.email.value;
        let message = event.currentTarget.message.value;
        setIsDirty(Boolean(email || message));
      }}
    >
      {/* existing code */}
    </fetcher.Form>
  );
}
```
## 3. Block navigation when the form is dirty
```tsx filename=routes/contact.tsx lines=[1,6-8]
export default function Contact() {
  let [isDirty, setIsDirty] = useState(false);
  let fetcher = useFetcher();
  let blocker = useBlocker(
    useCallback(() => isDirty, [isDirty]),
  );
  // ... existing code
}
```
While this will now block a navigation, there's no way for the user to confirm it.
## 4. Show confirmation UI
This uses a simple div, but you may want to use a modal dialog.
```tsx filename=routes/contact.tsx lines=[19-41]
export default function Contact() {
  let [isDirty, setIsDirty] = useState(false);
  let fetcher = useFetcher();
  let blocker = useBlocker(
    useCallback(() => isDirty, [isDirty]),
  );
  return (
    <fetcher.Form
      method="post"
      onChange={(event) => {
        let email = event.currentTarget.email.value;
        let message = event.currentTarget.message.value;
        setIsDirty(Boolean(email || message));
      }}
    >
      {/* existing code */}
      {blocker.state === "blocked" && (
        <div>
          <p>Wait! You didn't send the message yet:</p>
          <p>
            <button
              type="button"
              onClick={() => blocker.proceed()}
            >
              Leave
            </button>{" "}
            <button
              type="button"
              onClick={() => blocker.reset()}
            >
              Stay here
            </button>
          </p>
        </div>
      )}
    </fetcher.Form>
  );
}
```
If the user clicks "leave" then `blocker.proceed()` will proceed with the navigation. If they click "stay here" then `blocker.reset()` will clear the blocker and keep them on the current page.
## 5. Reset the blocker when the action resolves
If the user doesn't click either "leave" or "stay here", then submits the form, the blocker will still be active. Let's reset the blocker when the action resolves with an effect.
```tsx filename=routes/contact.tsx
useEffect(() => {
  if (fetcher.data?.ok) {
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  }
}, [fetcher.data]);
```
## 6. Clear the form when the action resolves
While unrelated to navigation blocking, let's clear the form when the action resolves with a ref.
```tsx
let formRef = useRef<HTMLFormElement>(null);
// put it on the form
<fetcher.Form
  ref={formRef}
  method="post"
  onChange={(event) => {
    // ... existing code
  }}
>
  {/* existing code */}
</fetcher.Form>;
```
```tsx
useEffect(() => {
  if (fetcher.data?.ok) {
    // clear the form in the effect
    formRef.current?.reset();
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  }
}, [fetcher.data]);
```
Alternatively, if a navigation is currently blocked, instead of resetting the blocker, you can proceed through to the blocked navigation.
```tsx
useEffect(() => {
  if (fetcher.data?.ok) {
    if (blocker.state === "blocked") {
      // proceed with the blocked navigation
      blocker.proceed();
    } else {
      formRef.current?.reset();
    }
  }
}, [fetcher.data]);
```
In this case the user flow is:
- User fills out the form
- User forgets to click "send" and clicks a link instead
- The navigation is blocked, and the confirmation message is shown
- Instead of clicking "leave" or "stay here", the user submits the form
- The user is taken to the requested page

---

## Page 153 — `docs/how-to/optimize-revalidation.md`

Live URL: https://reactrouter.com/how-to/optimize-revalidation

[copy pasted]
During client-side transitions, React Router will optimize reloading of routes that are already rendering, like not reloading layout routes that aren't changing. In other cases, like form submissions or search param changes, React Router doesn't know which routes need to be reloaded, so it reloads them all to be safe. This ensures your UI always stays in sync with the state on your server.
This function lets apps further optimize by returning `false` when React Router is about to reload a route. If you define this function on a route module, React Router will defer to your function on every navigation and every revalidation after an action is called. Again, this makes it possible for your UI to get out of sync with your server if you do it wrong, so be careful.
`fetcher.load` calls also revalidate, but because they load a specific URL, they don't have to worry about route param or URL search param revalidations. `fetcher.load`'s only revalidate by default after action submissions and explicit revalidation requests via [`useRevalidator`][use-revalidator].

---

## Page 154 — `docs/how-to/pre-rendering.md`

Live URL: https://reactrouter.com/how-to/pre-rendering

# Pre-Rendering
[MODES: framework]
<br/>
<br/>
Pre-Rendering allows you to speed up page loads for static content by rendering pages at build time instead of at runtime.
## Configuration
Pre-rendering is enabled via the `prerender` config in `react-router.config.ts`.
The simplest configuration is a boolean `true` which will pre-render all off the applications static paths based on `routes.ts`:
```ts filename=react-router.config.ts
export default {
  prerender: true,
} satisfies Config;
```
The boolean `true` will not include any dynamic paths (i.e., `/blog/:slug`) because the parameter values are unknown.
To configure specific paths including dynamic values, you can specify an array of paths:
```ts filename=react-router.config.ts
let slugs = getPostSlugs();
export default {
  prerender: [
    "/",
    "/blog",
    ...slugs.map((s) => `/blog/${s}`),
  ],
} satisfies Config;
```
If you need to perform more complex and/or asynchronous logic to determine the paths, you can also provide a function that returns an array of paths. This function provides you with a `getStaticPaths` method you can use to avoid manually adding all of the static paths in your application:
```ts filename=react-router.config.ts
export default {
  async prerender({ getStaticPaths }) {
    let slugs = await getPostSlugsFromCMS();
    return [
      ...getStaticPaths(), // "/" and "/blog"
      ...slugs.map((s) => `/blog/${s}`),
    ];
  },
} satisfies Config;
```
### Concurrency
By default, pages are pre-rendered one path at a time. You can enable concurrency to pre-render multiple paths in parallel which can speed up build times in many cases. You should experiment with the value that provides the best performance for your app.
To specify concurrency, move your `prerender` config down into a `prerender.paths` field and you can specify the concurrency in `prerender.concurrency`:
```ts filename=react-router.config.ts
let slugs = getPostSlugs();
export default {
  prerender: {
    paths: [
      "/",
      "/blog",
      ...slugs.map((s) => `/blog/${s}`),
    ],
    concurrency: 4,
  },
} satisfies Config;
```
## Pre-Rendering with/without a Runtime Server
Pre-Rendering can be used in two ways based on the `ssr` config value:
- Alongside a runtime SSR server with `ssr:true` (the default value)
- Deployed to a static file server with `ssr:false`
### Pre-rendering with `ssr:true`
When pre-rendering with `ssr:true`, you're indicating you will still have a runtime server but you are choosing to pre-render certain paths for quicker Response times.
```ts filename=react-router.config.ts
export default {
  // Can be omitted - defaults to true
  ssr: true,
  prerender: ["/", "/blog", "/blog/popular-post"],
} satisfies Config;
```
#### Data Loading and Pre-rendering
There is no extra application API for pre-rendering. Routes being pre-rendered use the same route `loader` functions as server rendering:
```tsx
export async function loader({ request, params }) {
  let post = await getPost(params.slug);
  return post;
}
export function Post({ loaderData }) {
  return <div>{loaderData.title}</div>;
}
```
Instead of a request coming to your route on a deployed server, the build creates a `new Request()` and runs it through your app just like a server would.
When server rendering, requests to paths that have not been pre-rendered will be server rendered as usual.
#### Static File Output
The rendered result will be written out to your `build/client` directory. You'll notice two files for each path:
- `[url].html` HTML file for initial document requests
- `[url].data` file for client side navigation browser requests
The output of your build will indicate what files were pre-rendered:
```sh
> react-router build
vite v5.2.11 building for production...
...
vite v5.2.11 building SSR bundle for production...
...
Prerender: Generated build/client/index.html
Prerender: Generated build/client/blog.data
Prerender: Generated build/client/blog/index.html
Prerender: Generated build/client/blog/my-first-post.data
Prerender: Generated build/client/blog/my-first-post/index.html
...
```
During development, pre-rendering doesn't save the rendered results to the public directory, this only happens for `react-router build`.
### Pre-rendering with `ssr:false`
The above examples assume you are deploying a runtime server but are pre-rendering some static pages to avoid hitting the server, resulting in faster loads.
To disable runtime SSR and configure pre-rendering to be served from a static file server, you can set the `ssr:false` config flag:
```ts filename=react-router.config.ts
export default {
  ssr: false, // disable runtime server rendering
  prerender: true, // pre-render all static routes
} satisfies Config;
```
If you specify `ssr:false` without a `prerender` config, React Router refers to that as [SPA Mode](./spa). In SPA Mode, we render a single HTML file that is capable of hydrating for _any_ of your application paths. It can do this because it only renders the `root` route into the HTML file and then determines which child routes to load based on the browser URL during hydration. This means you can use a `loader` on the root route, but not on any other routes because we don't know which routes to load until hydration in the browser.
If you want to pre-render paths with `ssr:false`, those matched routes _can_ have loaders because we'll pre-render all of the matched routes for those paths, not just the root. You cannot include `actions` or `headers` functions in any routes when `ssr:false` is set because there will be no runtime server to run them on.
#### Pre-rendering with a SPA Fallback
If you want `ssr:false` but don't want to pre-render _all_ of your routes - that's fine too! You may have some paths where you need the performance/SEO benefits of pre-rendering, but other pages where a SPA would be fine.
You can do this using the combination of config options as well - just limit your `prerender` config to the paths that you want to pre-render and React Router will also output a "SPA Fallback" HTML file that can be served to hydrate any other paths (using the same approach as [SPA Mode](./spa)).
This will be written to one of the following paths:
- `build/client/index.html` - If the `/` path is not pre-rendered
- `build/client/__spa-fallback.html` - If the `/` path is pre-rendered
```ts filename=react-router.config.ts
export default {
  ssr: false,
  // SPA fallback will be written to build/client/index.html
  prerender: ["/about-us"],
  // SPA fallback will be written to build/client/__spa-fallback.html
  prerender: ["/", "/about-us"],
} satisfies Config;
```
You can configure your deployment server to serve this file for any path that otherwise would 404. Some hosts do this by default, but others don't. As an example, a host may support a `_redirects` file to do this:
```
# If you did not pre-render the `/` route
/*    /index.html   200
# If you pre-rendered the `/` route
/*    /__spa-fallback.html   200
```
If you're getting 404s at valid routes for your app, it's likely you need to configure your host.
Here's another example of how you can do this with the [`sirv-cli`](https://www.npmjs.com/package/sirv-cli#user-content-single-page-applications) tool:
```sh
# If you did not pre-render the `/` route
sirv-cli build/client --single index.html
# If you pre-rendered the `/` route
sirv-cli build/client --single __spa-fallback.html
```
#### Invalid Exports
When pre-rendering with `ssr:false`, React Router will error at build time if you have invalid exports to help prevent some mistakes that can be easily overlooked.
- `headers`/`action` functions are prohibited in all routes because there will be no runtime server on which to run them
- When using `ssr:false` without a `prerender` config (SPA Mode), a `loader` is permitted on the root route only
- When using `ssr:false` with a `prerender` config, a `loader` is permitted on any route matched by a `prerender` path
  - If you are using a `loader` on a pre-rendered route that has child routes, you will need to make sure the parent `loaderData` can be determined at run-time properly by either:
    - Pre-rendering all child routes so that the parent `loader` can be called at build-time for each child route path and rendered into a `.data` file, or
    - Use a `clientLoader` on the parent that can be called at run-time for non-pre-rendered child paths

---

## Page 155 — `docs/how-to/presets.md`

Live URL: https://reactrouter.com/how-to/presets

# Presets
[MODES: framework]
<br/>
<br/>
The [React Router config][react-router-config] supports a `presets` option to ease integration with other tools and hosting providers.
[Presets][preset-type] can only do two things:
- Configure React Router config options on your behalf
- Validate the resolved config
The config returned by each preset is merged in the order the presets were defined. Any config directly specified in your React Router config will be merged last. This means that your config will always take precedence over any presets.
## Defining preset config
As a basic example, let's create a preset that configures a [server bundles function][server-bundles]:
```ts filename=my-cool-preset.ts
export function myCoolPreset(): Preset {
  return {
    name: "my-cool-preset",
    reactRouterConfig: () => ({
      serverBundles: ({ branch }) => {
        const isAuthenticatedRoute = branch.some((route) =>
          route.id.split("/").includes("_authenticated"),
        );
        return isAuthenticatedRoute
          ? "authenticated"
          : "unauthenticated";
      },
    }),
  };
}
```
## Validating config
Keep in mind that other presets and user config can still override the values returned from your preset.
In our example preset, the `serverBundles` function could be overridden with a different, conflicting implementation. If we want to validate that the final resolved config contains the `serverBundles` function from our preset, we can use the `reactRouterConfigResolved` hook:
```ts filename=my-cool-preset.ts lines=[22-27]
const serverBundles: ServerBundlesFunction = ({
  branch,
}) => {
  const isAuthenticatedRoute = branch.some((route) =>
    route.id.split("/").includes("_authenticated"),
  );
  return isAuthenticatedRoute
    ? "authenticated"
    : "unauthenticated";
};
export function myCoolPreset(): Preset {
  return {
    name: "my-cool-preset",
    reactRouterConfig: () => ({ serverBundles }),
    reactRouterConfigResolved: ({ reactRouterConfig }) => {
      if (
        reactRouterConfig.serverBundles !== serverBundles
      ) {
        throw new Error("`serverBundles` was overridden!");
      }
    },
  };
}
```
The `reactRouterConfigResolved` hook should only be used when it would be an error to merge or override your preset's config.
## Using a preset
Presets are designed to be published to npm and used within your React Router config.
```ts filename=react-router.config.ts lines=[6]
export default {
  // ...
  presets: [myCoolPreset()],
} satisfies Config;
```
[react-router-config]: https://api.reactrouter.com/v7/types/_react-router_dev.config.Config.html
[preset-type]: https://api.reactrouter.com/v7/types/_react-router_dev.config.Preset.html
[server-bundles]: ./server-bundles

---

## Page 156 — `docs/how-to/react-server-components.md`

Live URL: https://reactrouter.com/how-to/react-server-components

# React Server Components
[MODES: framework, data]
<br/>
<br/>
<docs-warning>React Server Components support is experimental and subject to breaking changes in
minor/patch releases. Please use with caution and pay **very** close attention
to release notes for relevant changes.</docs-warning>
React Server Components (RSC) refers generally to an architecture and set of APIs provided by React since version 19.
From the docs:
> Server Components are a new type of Component that renders ahead of time, before bundling, in an environment separate from your client app or SSR server.
>
> <cite>- [React "Server Components" docs][react-server-components-doc]</cite>
React Router provides a set of APIs for integrating with RSC-compatible bundlers, allowing you to leverage [Server Components][react-server-components-doc] and [Server Functions][react-server-functions-doc] in your React Router applications.
If you're unfamiliar with these React features, we recommend reading the official [Server Components documentation][react-server-components-doc] before using React Router's RSC APIs.
RSC support is available in both Framework and Data Modes. For more information on the conceptual difference between these, see ["Picking a Mode"][picking-a-mode]. However, note that the APIs and features differ between RSC and non-RSC modes in ways that this guide will cover in more detail.
## Quick Start
The quickest way to get started is with one of our templates.
These templates come with React Router RSC APIs already configured, offering you out of the box features such as:
- Server Side Rendering (SSR)
- Server Components
- Client Components (via [`"use client"`][use-client-docs] directive)
- Server Functions (via [`"use server"`][use-server-docs] directive)
### RSC Framework Mode Template
The [RSC Framework Mode template][framework-rsc-template] uses the unstable React Router RSC Vite plugin along with the experimental [`@vitejs/plugin-rsc` plugin][vite-plugin-rsc].
```shellscript
npx create-react-router@latest --template remix-run/react-router-templates/unstable_rsc-framework-mode
```
### RSC Data Mode Templates
The [Vite RSC Data Mode template][vite-rsc-template] uses the experimental Vite `@vitejs/plugin-rsc` plugin.
```shellscript
npx create-react-router@latest --template remix-run/react-router-templates/unstable_rsc-data-mode-vite
```
## RSC Framework Mode
Most APIs and features in RSC Framework Mode are the same as non-RSC Framework Mode, so this guide will focus on the differences.
### New React Router RSC Vite Plugin
RSC Framework Mode uses a different Vite plugin than non-RSC Framework Mode, currently exported as `unstable_reactRouterRSC`.
This new Vite plugin also has a peer dependency on the experimental `@vitejs/plugin-rsc` plugin. Note that the `@vitejs/plugin-rsc` plugin should be placed after the React Router RSC plugin in your Vite config.
```tsx filename=vite.config.ts
export default defineConfig({
  plugins: [reactRouterRSC(), rsc()],
});
```
### Build Output
The RSC Framework Mode server build file (`build/server/index.js`) exports a `default` request handler function (`(request: Request) => Promise<Response>`) for document/data requests.
If needed, you can convert this into a [standard Node.js request listener][node-request-listener] for use with Node's built-in `http.createServer` function (or anything that supports it, e.g. [Express][express]) by using the `createRequestListener` function from [@remix-run/node-fetch-server][node-fetch-server].
For example, in Express:
```tsx filename=start.js
const app = express();
app.use(
  "/assets",
  express.static("build/client/assets", {
    immutable: true,
    maxAge: "1y",
  }),
);
app.use(express.static("build/client"));
app.use(createRequestListener(requestHandler));
app.listen(3000);
```
### React Elements From Loaders/Actions
In RSC Framework Mode, loaders and actions can return React elements along with other data. These elements will only ever be rendered on the server.
```tsx
export async function loader() {
  return {
    message: "Message from the server!",
    element: <p>Element from the server!</p>,
  };
}
export default function Route({
  loaderData,
}: Route.ComponentProps) {
  return (
    <>
      <h1>{loaderData.message}</h1>
      {loaderData.element}
    </>
  );
}
```
If you need to use client-only features (e.g. [Hooks][hooks], event handlers) within React elements returned from loaders/actions, you'll need to extract components using these features into a [client module][use-client-docs]:
```tsx filename=src/routes/counter/counter.tsx
"use client";
export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```
```tsx filename=src/routes/counter/route.tsx
export async function loader() {
  return {
    message: "Message from the server!",
    element: (
      <>
        <p>Element from the server!</p>
        <Counter />
      </>
    ),
  };
}
export default function Route({
  loaderData,
}: Route.ComponentProps) {
  return (
    <>
      <h1>{loaderData.message}</h1>
      {loaderData.element}
    </>
  );
}
```
### Route Server Components
If a route exports a `ServerComponent` instead of the typical `default` component export, the route renders on the server instead of the client. A route module cannot export both `default` and `ServerComponent`.
You can still export client-only annotations like `clientLoader` and `clientAction` alongside a `ServerComponent`. The other route module component exports follow the same client/server split: `ErrorBoundary`, `Layout`, and `HydrateFallback` are client components, while `ServerErrorBoundary`, `ServerLayout`, and `ServerHydrateFallback` render on the server.
The following route module components have their own mutually exclusive server component counterparts:
| Server Component Export | Client Component  |
| ----------------------- | ----------------- |
| `ServerComponent`       | `default`         |
| `ServerErrorBoundary`   | `ErrorBoundary`   |
| `ServerLayout`          | `Layout`          |
| `ServerHydrateFallback` | `HydrateFallback` |
```tsx
export async function loader() {
  return {
    message: await getMessage(),
  };
}
export function ServerComponent({
  loaderData,
}: Route.ServerComponentProps) {
  return (
    <>
      <h1>Server Component Route</h1>
      <p>Message from the server: {loaderData.message}</p>
      <Outlet />
    </>
  );
}
```
If you need to use client-only features (e.g. [Hooks][hooks], event handlers) within a server-first route, you'll need to extract components using these features into a [client module][use-client-docs]:
```tsx filename=src/routes/counter/counter.tsx
"use client";
export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```
```tsx filename=src/routes/counter/route.tsx
export function ServerComponent() {
  return (
    <>
      <h1>Counter</h1>
      <Counter />
    </>
  );
}
```
### `.server`/`.client` Modules
To avoid confusion with RSC's `"use server"` and `"use client"` directives, support for [`.server` modules][server-modules] and [`.client` modules][client-modules] is no longer built-in when using RSC Framework Mode.
As an alternative solution that doesn't rely on file naming conventions, we recommend using the `"server-only"` and `"client-only"` imports provided by [`@vitejs/plugin-rsc`][vite-plugin-rsc]. For example, to ensure a module is never accidentally included in the client build, simply import from `"server-only"` as a side effect within your server-only module.
```ts filename=app/utils/db.ts
// Rest of the module...
```
Note that while there are official npm packages [`server-only`][server-only-package] and [`client-only`][client-only-package] created by the React team, they don't need to be installed. `@vitejs/plugin-rsc` internally handles these imports and provides build-time validation instead of runtime errors.
If you'd like to quickly migrate existing code that relies on the `.server` and `.client` file naming conventions, we recommend using the [`vite-env-only` plugin][vite-env-only] directly. For example, to ensure `.server` modules aren't accidentally included in the client build:
```tsx filename=vite.config.ts
export default defineConfig({
  plugins: [
    denyImports({
      client: { files: ["**/.server/*", "**/*.server.*"] },
    }),
    reactRouterRSC(),
    rsc(),
  ],
});
```
### MDX Route Support
MDX routes are supported in RSC Framework Mode when using `@mdx-js/rollup` v3.1.1+.
Note that any components exported from an MDX route must also be valid in RSC environments, meaning that they cannot use client-only features like [Hooks][hooks]. Any components that need to use these features should be extracted into a [client module][use-client-docs].
### Custom Entry Files
RSC Framework Mode supports custom entry files, allowing you to customize the behavior of the RSC server, SSR server, and client entry points.
The plugin will automatically detect custom entry files in your `app` directory:
- `app/entry.rsc.ts` (or `.tsx`) - Custom RSC server entry
- `app/entry.ssr.ts` (or `.tsx`) - Custom SSR server entry
- `app/entry.client.tsx` - Custom client entry
If these files are not found, React Router will use the default entries provided by the framework.
If you want to inspect the generated defaults before overriding them, you can also use `react-router reveal entry.client`, `react-router reveal entry.rsc`, and `react-router reveal entry.ssr`.
#### Basic Override Pattern
You can create a custom entry file that wraps or extends the default behavior. For example, to add custom logging to the RSC entry:
```ts filename=app/entry.rsc.ts
export default {
  fetch(request: Request): Promise<Response> {
    console.log(
      "Custom RSC entry handling request:",
      request.url,
    );
    const requestContext = new RouterContextProvider();
    return defaultEntry.fetch(request, requestContext);
  },
};
if (import.meta.hot) {
  import.meta.hot.accept();
}
```
Similarly, you can customize the SSR entry:
```ts filename=app/entry.ssr.ts
export function generateHTML(
  request: Request,
  serverResponse: Response,
): Promise<Response> {
  console.log(
    "Custom SSR entry generating HTML for:",
    request.url,
  );
  return defaultGenerateHTML(request, serverResponse);
}
```
And for the client:
```ts filename=app/entry.client.ts
```
#### Copying Default Entries
For more advanced customization, you can copy the default entries and modify them as needed. To find the default entries:
1. In your IDE, use "Go to Definition" (or Cmd/Ctrl+Click) on the default entry import:
   ```ts
   import defaultEntry from "@react-router/dev/config/default-rsc-entries/entry.rsc";
   ```
2. Copy the default entry code into your custom file
3. Modify it to suit your needs
The default entries are located at:
- [`@react-router/dev/config/default-rsc-entries/entry.rsc`][entry-rsc-source]
- [`@react-router/dev/config/default-rsc-entries/entry.ssr`][entry-ssr-source]
- [`@react-router/dev/config/default-rsc-entries/entry.client`][entry-client-source]
You can view the source code on GitHub using the links above, or navigate directly to these files in `node_modules/@react-router/dev/dist/config/default-rsc-entries/`.
<docs-info>
When copying default entries, make sure to maintain the required exports:
- `entry.rsc.ts` must export a default object with a `fetch` method
- `entry.ssr.ts` must export a `generateHTML` function
- `entry.client.tsx` should handle client-side hydration
</docs-info>
### Unsupported Config Options
The following options from `react-router.config.ts` are not currently supported in RSC Framework Mode:
- `buildEnd`
- `presets`
- `serverBundles`
- `future.v8_splitRouteModules`
- `subResourceIntegrity`
## RSC Data Mode
The RSC Framework Mode APIs described above are built on top of lower-level RSC Data Mode APIs.
RSC Data Mode is missing some of the features of RSC Framework Mode (e.g. `routes.ts` config and file system routing, HMR and Hot Data Revalidation), but is more flexible and allows you to integrate with your own bundler and server abstractions.
### Configuring Routes
Routes are configured as an argument to [`matchRSCServerRequest`][match-rsc-server-request]. At a minimum, you need a path and component:
```tsx
function Root() {
  return <h1>Hello world</h1>;
}
matchRSCServerRequest({
  // ...other options
  routes: [{ path: "/", Component: Root }],
});
```
While you can define components inline, we recommend using the `lazy()` option and defining [Route Modules][route-module] for both startup performance and code organization.
<docs-info>
The `lazy` field of the RSC route config expects the same exports as the [Route Module API][route-module], which keeps the route-module shape consistent across [Framework Mode][framework-mode] and RSC Data Mode.
That includes exports like `loader`, `action`, `meta`, `links`, `headers`, `ErrorBoundary`, `HydrateFallback`, and the client annotations.
</docs-info>
```tsx filename=app/routes.ts
export function routes() {
  return [
    {
      id: "root",
      path: "",
      lazy: () => import("./root/route"),
      children: [
        {
          id: "home",
          index: true,
          lazy: () => import("./home/route"),
        },
        {
          id: "about",
          path: "about",
          lazy: () => import("./about/route"),
        },
      ],
    },
  ] satisfies RSCRouteConfig;
}
```
### Server Component Routes
By default each route's `default` export renders a Server Component
```tsx
export default function Home() {
  return (
    <main>
      <article>
        <h1>Welcome to React Router RSC</h1>
        <p>
          You won't find me running any JavaScript in the
          browser!
        </p>
      </article>
    </main>
  );
}
```
A nice feature of Server Components is that you can fetch data directly from your component by making it asynchronous.
```tsx
export default async function Home() {
  let user = await getUserData();
  return (
    <main>
      <article>
        <h1>Welcome to React Router RSC</h1>
        <p>
          You won't find me running any JavaScript in the
          browser!
        </p>
        <p>
          Hello, {user ? user.name : "anonymous person"}!
        </p>
      </article>
    </main>
  );
}
```
<docs-info>
Server Components can also be returned from your loaders and actions. In general, if you are using RSC to build your application, loaders are primarily useful for things like setting `status` codes or returning a `redirect`.
Using Server Components in loaders can be helpful for incremental adoption of RSC.
</docs-info>
### Server Functions
[Server Functions][react-server-functions-doc] are a React feature that allow you to call async functions executed on the server. They're defined with the [`"use server"`][use-server-docs] directive.
```tsx
"use server";
export async function updateFavorite(formData: FormData) {
  let movieId = formData.get("id");
  let intent = formData.get("intent");
  if (intent === "add") {
    await addFavorite(Number(movieId));
  } else {
    await removeFavorite(Number(movieId));
  }
}
```
```tsx
export async function AddToFavoritesForm({
  movieId,
}: {
  movieId: number;
}) {
  let isFav = await isFavorite(movieId);
  return (
    <form action={updateFavorite}>
      <input type="hidden" name="id" value={movieId} />
      <input
        type="hidden"
        name="intent"
        value={isFav ? "remove" : "add"}
      />
      <AddToFavoritesButton isFav={isFav} />
    </form>
  );
}
```
Note that after server functions are called, React Router will automatically revalidate the route and update the UI with the new server content. You don't have to mess around with any cache invalidation.
### Client Properties
Routes are defined on the server at runtime, but we can still provide `clientLoader`, `clientAction`, and `shouldRevalidate` through the utilization of client references and `"use client"`.
```tsx filename=src/routes/root/client.tsx
"use client";
export function clientAction() {}
export function clientLoader() {}
export function shouldRevalidate() {}
export default function ClientRoot() {
  return <p>Client route</p>;
}
```
We can then re-export these from our lazy loaded route module:
```tsx filename=src/routes/root/route.tsx
export {
  clientAction,
  clientLoader,
  shouldRevalidate,
} from "./client";
export default function Root() {
  // ...
}
```
This is also the way we would make an entire route a Client Component.
```tsx filename=src/routes/root/route.tsx lines=[1,11]
export {
  clientAction,
  clientLoader,
  shouldRevalidate,
} from "./client";
export default function Root() {
  // Adding a Server Component at the root is required by bundlers
  // if you're using css side-effects imports.
  return <ClientRoot />;
}
```
### Bundler Configuration
React Router provides several APIs that allow you to easily integrate with RSC-compatible bundlers, useful if you are using React Router Data Mode to make your own [custom framework][custom-framework].
The following steps show how to setup a React Router application to use Server Components (RSC) to server-render (SSR) pages and hydrate them for single-page app (SPA) navigations. You don't have to use SSR (or even client-side hydration) if you don't want to. You can also leverage the HTML generation for Static Site Generation (SSG) or Incremental Static Regeneration (ISR) if you prefer. This guide is meant merely to explain how to wire up all the different APIs for a typically RSC-based application.
### Entry points
Besides our [route definitions](#configuring-routes), we will need to configure the following:
1. A server to handle the incoming request, fetch the RSC payload, and convert it into HTML
2. A React server to generate RSC payloads
3. A browser handler to hydrate the generated HTML and set the `callServer` function to support post-hydration server actions
The following naming conventions have been chosen for familiarity and simplicity. Feel free to name and configure your entry points as you see fit.
See the relevant bundler documentation below for specific code examples for each of the following entry points.
These examples all use [express][express] and [@remix-run/node-fetch-server][node-fetch-server] for the server and request handling.
**Routes**
See [Configuring Routes](#configuring-routes).
**Server**
<docs-info>
You don't have to use SSR at all. You can choose to use RSC to "prerender" HTML for Static Site Generation (SSG) or something like Incremental Static Regeneration (ISR).
</docs-info>
`entry.ssr.tsx` is the entry point for the server. It is responsible for handling the request, calling the RSC server, and converting the RSC payload into HTML on document requests (server-side rendering).
Relevant APIs:
- [`routeRSCServerRequest`][route-rsc-server-request]
- [`RSCStaticRouter`][rsc-static-router]
**RSC Server**
<docs-info>
Even though you have a "React Server" and a server responsible for request handling/SSR, you don't actually need to have 2 separate servers. You can simply have 2 separate module graphs within the same server. This is important because React behaves differently when generating RSC payloads vs. when generating HTML to be hydrated on the client.
</docs-info>
`entry.rsc.tsx` is the entry point for the React Server. It is responsible for matching the request to a route and generating RSC payloads.
Relevant APIs:
- [`matchRSCServerRequest`][match-rsc-server-request]
**Browser**
`entry.browser.tsx` is the entry point for the client. It is responsible for hydrating the generated HTML and setting the `callServer` function to support post-hydration server actions.
Relevant APIs:
- [`createCallServer`][create-call-server]
- [`getRSCStream`][get-rsc-stream]
- [`RSCHydratedRouter`][rsc-hydrated-router]
### Vite
See the [@vitejs/plugin-rsc docs][vite-plugin-rsc] for more information. You can also refer to our [Vite RSC Data Mode template][vite-rsc-template] to see a working version.
In addition to `react`, `react-dom`, and `react-router`, you'll need the following dependencies:
```shellscript
npm i -D vite @vitejs/plugin-react @vitejs/plugin-rsc
```
#### `vite.config.ts`
To configure Vite, add the following to your `vite.config.ts`:
```ts filename=vite.config.ts
export default defineConfig({
  plugins: [
    react(),
    rsc({
      entries: {
        client: "src/entry.browser.tsx",
        rsc: "src/entry.rsc.tsx",
        ssr: "src/entry.ssr.tsx",
      },
    }),
  ],
});
```
```tsx filename=src/routes/config.ts
export function routes() {
  return [
    {
      id: "root",
      path: "",
      lazy: () => import("./root/route"),
      children: [
        {
          id: "home",
          index: true,
          lazy: () => import("./home/route"),
        },
        {
          id: "about",
          path: "about",
          lazy: () => import("./about/route"),
        },
      ],
    },
  ] satisfies RSCRouteConfig;
}
```
#### `entry.ssr.tsx`
The following is a simplified example of a Vite SSR Server.
```tsx filename=src/entry.ssr.tsx
export async function generateHTML(
  request: Request,
  serverResponse: Response,
): Promise<Response> {
  return await routeRSCServerRequest({
    // The incoming request.
    request,
    // The React Server response
    serverResponse,
    // Provide the React Server touchpoints.
    createFromReadableStream,
    // Render the router to HTML.
    async renderHTML(getPayload, options) {
      const payload = await getPayload();
      const formState =
        payload.type === "render"
          ? await payload.formState
          : undefined;
      const bootstrapScriptContent =
        await import.meta.viteRsc.loadBootstrapScriptContent(
          "index",
        );
      return await renderHTMLToReadableStream(
        <RSCStaticRouter getPayload={getPayload} />,
        {
          ...options,
          bootstrapScriptContent,
          formState,
          signal: request.signal,
        },
      );
    },
  });
}
```
#### `entry.rsc.tsx`
The following is a simplified example of a Vite RSC Server.
```tsx filename=src/entry.rsc.tsx
function fetchServer(request: Request) {
  return matchRSCServerRequest({
    // Provide the React Server touchpoints.
    createTemporaryReferenceSet,
    decodeAction,
    decodeFormState,
    decodeReply,
    loadServerAction,
    // The incoming request.
    request,
    // The app routes.
    routes: routes(),
    // Encode the match with the React Server implementation.
    generateResponse(match, options) {
      return new Response(
        renderToReadableStream(match.payload, options),
        {
          status: match.statusCode,
          headers: match.headers,
        },
      );
    },
  });
}
export default async function handler(request: Request) {
  // Import the generateHTML function from the client environment
  const ssr = await import.meta.viteRsc.loadModule<
    typeof import("./entry.ssr")
  >("ssr", "index");
  return ssr.generateHTML(
    request,
    await fetchServer(request),
  );
}
```
#### `entry.browser.tsx`
```tsx filename=src/entry.browser.tsx
// Create and set the callServer function to support post-hydration server actions.
setServerCallback(
  createCallServer({
    createFromReadableStream,
    createTemporaryReferenceSet,
    encodeReply,
  }),
);
// Get and decode the initial server payload.
createFromReadableStream<RSCPayload>(getRSCStream()).then(
  (payload) => {
    startTransition(async () => {
      const formState =
        payload.type === "render"
          ? await payload.formState
          : undefined;
      hydrateRoot(
        document,
        <StrictMode>
          <RSCHydratedRouter
            createFromReadableStream={
              createFromReadableStream
            }
            payload={payload}
          />
        </StrictMode>,
        {
          formState,
        },
      );
    });
  },
);
```
[picking-a-mode]: ../start/modes
[react-server-components-doc]: https://react.dev/reference/rsc/server-components
[react-server-functions-doc]: https://react.dev/reference/rsc/server-functions
[use-client-docs]: https://react.dev/reference/rsc/use-client
[use-server-docs]: https://react.dev/reference/rsc/use-server
[route-module]: ../start/framework/route-module
[framework-mode]: ../start/modes#framework
[custom-framework]: ../start/data/custom
[vite-plugin-rsc]: https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc
[match-rsc-server-request]: ../api/rsc/matchRSCServerRequest
[route-rsc-server-request]: ../api/rsc/routeRSCServerRequest
[rsc-static-router]: ../api/rsc/RSCStaticRouter
[create-call-server]: ../api/rsc/createCallServer
[get-rsc-stream]: ../api/rsc/getRSCStream
[rsc-hydrated-router]: ../api/rsc/RSCHydratedRouter
[express]: https://expressjs.com/
[node-fetch-server]: https://www.npmjs.com/package/@remix-run/node-fetch-server
[framework-rsc-template]: https://github.com/remix-run/react-router-templates/tree/main/unstable_rsc-framework-mode
[vite-rsc-template]: https://github.com/remix-run/react-router-templates/tree/main/unstable_rsc-data-mode-vite
[node-request-listener]: https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener
[hooks]: https://react.dev/reference/react/hooks
[vite-env-only]: https://github.com/pcattori/vite-env-only
[server-modules]: ../api/framework-conventions/server-modules
[client-modules]: ../api/framework-conventions/client-modules
[server-only-package]: https://www.npmjs.com/package/server-only
[client-only-package]: https://www.npmjs.com/package/client-only
[entry-rsc-source]: https://github.com/remix-run/react-router/blob/main/packages/react-router-dev/config/default-rsc-entries/entry.rsc.tsx
[entry-ssr-source]: https://github.com/remix-run/react-router/blob/main/packages/react-router-dev/config/default-rsc-entries/entry.ssr.tsx
[entry-client-source]: https://github.com/remix-run/react-router/blob/main/packages/react-router-dev/config/default-rsc-entries/entry.client.tsx

---

## Page 157 — `docs/how-to/resource-routes.md`

Live URL: https://reactrouter.com/how-to/resource-routes

# Resource Routes
[MODES: framework, data]
<br/>
<br/>
When server rendering, routes can serve "resources" instead of rendering components, like images, PDFs, JSON payloads, webhooks, etc.
## Defining a Resource Route
A route becomes a resource route by convention when its module exports a loader or action but does not export a default component.
Consider a route that serves a PDF instead of UI:
```ts
route("/reports/pdf/:id", "pdf-report.ts");
```
```tsx filename=pdf-report.ts
export async function loader({ params }: Route.LoaderArgs) {
  const report = await getReport(params.id);
  const pdf = await generateReportPDF(report);
  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
    },
  });
}
```
Note there is no default export. That makes this route a resource route.
## Linking to Resource Routes
When linking to resource routes, use `<a>` or `<Link reloadDocument>`, otherwise React Router will attempt to use client side routing and fetching the payload (you'll get a helpful error message if you make this mistake).
```tsx
<Link reloadDocument to="/reports/pdf/123">
  View as PDF
</Link>
```
## Handling different request methods
GET requests are handled by the `loader`, while POST, PUT, PATCH, and DELETE are handled by the `action`:
```tsx
export function loader(_: Route.LoaderArgs) {
  return Response.json({ message: "I handle GET" });
}
export function action(_: Route.ActionArgs) {
  return Response.json({
    message: "I handle everything else",
  });
}
```
## Return Types
Resource Routes are flexible when it comes to the return type - you can return [`Response`][Response] instances or [`data()`][data] objects. A good general rule of thumb when deciding which type to use is:
- If you're using resource routes intended for external consumption, return `Response` instances
  - Keeps the resulting response encoding explicit in your code rather than having to wonder how React Router might convert `data() -> Response` under the hood
- If you're accessing resource routes from [fetchers][fetcher] or [`<Form>`][form] submissions, return `data()`
  - Keeps things consistent with the loaders/actions in your UI routes
  - Allows you to stream promises down to your UI through `data()`/[`Await`][await]
## Error Handling
Throwing an `Error` from Resource route (or anything other than a `Response`/`data()`) will trigger [`handleError`][handleError] and result in a 500 HTTP Response:
```tsx
export function action() {
  let db = await getDb();
  if (!db) {
    // Fatal error - return a 500 response and trigger `handleError`
    throw new Error("Could not connect to DB");
  }
  // ...
}
```
If a resource route generates a `Response` (via `new Response()` or `data()`), it is considered a successful execution and will not trigger `handleError` because the API has successfully produced a Response for the HTTP request. This applies to thrown responses as well as returned responses with a 4xx/5xx status code. This behavior aligns with `fetch()` which does not return a rejected promise on 4xx/5xx Responses.
```tsx
export function action() {
  // Non-fatal error - don't trigger `handleError`:
  throw new Response(
    { error: "Unauthorized" },
    { status: 401 },
  );
  // These 3 are equivalent to the above
  return new Response(
    { error: "Unauthorized" },
    { status: 401 },
  );
  throw data({ error: "Unauthorized" }, { status: 401 });
  return data({ error: "Unauthorized" }, { status: 401 });
}
```
### Error Boundaries
[Error Boundaries][error-boundary] are only applicable when a resource route is accessed from a UI, such as from a [`fetcher`][fetcher] call or a [`<Form>`][form] submission. If you `throw` from your resource route in these cases, it will bubble to the nearest `ErrorBoundary` in the UI.
[handleError]: ../api/framework-conventions/entry.server.tsx#handleerror
[data]: ../api/utils/data
[Response]: https://developer.mozilla.org/en-US/docs/Web/API/Response
[fetcher]: ../api/hooks/useFetcher
[form]: ../api/components/Form
[await]: ../api/components/Await
[error-boundary]: ../start/framework/route-module#errorboundary

---

## Page 158 — `docs/how-to/route-module-type-safety.md`

Live URL: https://reactrouter.com/how-to/route-module-type-safety

# Route Module Type Safety
[MODES: framework]
<br/>
<br/>
React Router generates route-specific types to power type inference for URL params, loader data, and more.
This guide will help you set it up if you didn't start with a template.
To learn more about how type safety works in React Router, check out [Type Safety Explanation](../explanation/type-safety).
## 1. Add `.react-router/` to `.gitignore`
React Router generates types into a `.react-router/` directory at the root of your app. This directory is fully managed by React Router and should be gitignore'd.
```txt
.react-router/
```
## 2. Include the generated types in tsconfig
Edit your tsconfig to get TypeScript to use the generated types. Additionally, `rootDirs` needs to be configured so the types can be imported as relative siblings to route modules.
```json filename=tsconfig.json
{
  "include": [".react-router/types/**/*"],
  "compilerOptions": {
    "rootDirs": [".", "./.react-router/types"]
  }
}
```
If you are using multiple `tsconfig` files for your app, you'll need to make these changes in whichever one `include`s your app directory.
For example, the [`node-custom-server` template](https://github.com/remix-run/react-router-templates/tree/390fcec476dd336c810280479688fe893da38713/node-custom-server) contains `tsconfig.json`, `tsconfig.node.json`, and `tsconfig.vite.json`. Since `tsconfig.vite.json` is the one that [includes the app directory](https://github.com/remix-run/react-router-templates/blob/390fcec476dd336c810280479688fe893da38713/node-custom-server/tsconfig.vite.json#L4-L6), that's the one that sets up `.react-router/types` for route module type safety.
## 3. Generate types before type checking
If you want to run type checking as its own command — for example, as part of your Continuous Integration pipeline — you'll need to make sure to generate types _before_ running typechecking:
```json
{
  "scripts": {
    "typecheck": "react-router typegen && tsc"
  }
}
```
## 4. Typing `AppLoadContext`
## Extending app `Context` types
To define your app's `context` type, add the following in a `.ts` or `.d.ts` file within your project:
```typescript
declare module "react-router" {
  interface AppLoadContext {
    // add context properties here
  }
}
```
## 5. Type-only auto-imports (optional)
When auto-importing the `Route` type helper, TypeScript will generate:
```ts filename=app/routes/my-route.tsx
```
But if you enable [verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/#verbatimModuleSyntax):
```json filename=tsconfig.json
{
  "compilerOptions": {
    "verbatimModuleSyntax": true
  }
}
```
Then, you will get the `type` modifier for the import automatically as well:
```ts filename=app/routes/my-route.tsx
//     ^^^^
```
This helps tools like bundlers to detect type-only module that can be safely excluded from the bundle.
## Conclusion
React Router's Vite plugin should be automatically generating types into `.react-router/types/` anytime you edit your route config (`routes.ts`).
That means all you need to do is run `react-router dev` (or your custom dev server) to get to up-to-date types in your routes.
Check out our [Type Safety Explanation](../explanation/type-safety) for an example of how to pull in those types into your routes.

---

## Page 159 — `docs/how-to/search-params.md`

Live URL: https://reactrouter.com/how-to/search-params



---

## Page 160 — `docs/how-to/security.md`

Live URL: https://reactrouter.com/how-to/security

# Security
[MODES: framework]
<br/>
<br/>
This is by no means a comprehensive guide, but React Router provides features to help address a few aspects under the _very large_ umbrella that is _Security_.
## `Content-Security-Policy`
If you are implementing a [Content-Security-Policy (CSP)][csp] in your application, specifically one using the `unsafe-inline` directive, you will need to specify a [`nonce`][nonce] attribute on the inline `<script>` elements rendered in your HTML. This must be specified on any API that generates inline scripts, including:
- [`<Scripts nonce>`][scripts] (`root.tsx`)
- [`<ScrollRestoration nonce>`][scrollrestoration] (`root.tsx`)
- [`<ServerRouter nonce>`][serverrouter] (`entry.server.tsx`)
- [`renderToPipeableStream(..., { nonce })`][renderToPipeableStream] (`entry.server.tsx`)
- [`renderToReadableStream(..., { nonce })`][renderToReadableStream] (`entry.server.tsx`)
[csp]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
[nonce]: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/nonce
[renderToPipeableStream]: https://react.dev/reference/react-dom/server/renderToPipeableStream
[renderToReadableStream]: https://react.dev/reference/react-dom/server/renderToReadableStream
[scripts]: ../api/components/Scripts
[scrollrestoration]: ../api/components/ScrollRestoration
[serverrouter]: ../api/components/ServerRouter

---

## Page 161 — `docs/how-to/server-bundles.md`

Live URL: https://reactrouter.com/how-to/server-bundles

# Server Bundles
[MODES: framework]
<br/>
<br/>
<docs-warning>This is an advanced feature designed for hosting provider integrations. When compiling your app into multiple server bundles, there will need to be a custom routing layer in front of your app directing requests to the correct bundle.</docs-warning>
React Router typically builds your server code into a single bundle that exports a request handler function. However, there are scenarios where you might want to split your route tree into multiple server bundles, each exposing a request handler function for a subset of routes. To provide this flexibility, [`react-router.config.ts`][react-router-config] supports a `serverBundles` option, which is a function for assigning routes to different server bundles.
The [`serverBundles` function][server-bundles-function] is called for each route in the tree (except for routes that aren't addressable, e.g., pathless layout routes) and returns a server bundle ID that you'd like to assign that route to. These bundle IDs will be used as directory names in your server build directory.
For each route, this function receives an array of routes leading to and including that route, referred to as the route `branch`. This allows you to create server bundles for different portions of the route tree. For example, you could use this to create a separate server bundle containing all routes within a particular layout route:
```ts filename=react-router.config.ts lines=[5-13]
export default {
  // ...
  serverBundles: ({ branch }) => {
    const isAuthenticatedRoute = branch.some((route) =>
      route.id.split("/").includes("_authenticated"),
    );
    return isAuthenticatedRoute
      ? "authenticated"
      : "unauthenticated";
  },
} satisfies Config;
```
Each `route` in the `branch` array contains the following properties:
- `id` — The unique ID for this route, named like its `file` but relative to the app directory and without the extension, e.g., `app/routes/gists.$username.tsx` will have an `id` of `routes/gists.$username`
- `path` — The path this route uses to match the URL pathname
- `file` — The absolute path to the entry point for this route
- `index` — Whether this route is an index route
## Build manifest
When the build is complete, React Router will call the `buildEnd` hook, passing a `buildManifest` object. This is useful if you need to inspect the build manifest to determine how to route requests to the correct server bundle.
```ts filename=react-router.config.ts lines=[5-7]
export default {
  // ...
  buildEnd: async ({ buildManifest }) => {
    // ...
  },
} satisfies Config;
```
When using server bundles, the build manifest contains the following properties:
- `serverBundles` — An object that maps bundle IDs to the bundle's `id` and `file`
- `routeIdToServerBundleId` — An object that maps route IDs to their server bundle ID
- `routes` — A route manifest that maps route IDs to route metadata. This can be used to drive a custom routing layer in front of your React Router request handlers
[react-router-config]: https://api.reactrouter.com/v7/types/_react-router_dev.config.Config.html
[server-bundles-function]: https://api.reactrouter.com/v7/types/_react-router_dev.config.ServerBundlesFunction.html

---

## Page 162 — `docs/how-to/spa.md`

Live URL: https://reactrouter.com/how-to/spa

# Single Page App (SPA)
[MODES: framework]
<br/>
<br/>
<docs-info>This guide focuses on how to build Single Page Apps with React Router Framework mode. If you're using React Router in declarative or data mode, you can design your own SPA architecture.</docs-info>
When using React Router as a framework, you can enable "SPA Mode" by setting `ssr:false` in your `react-router.config.ts` file. This will disable runtime server rendering and generate an `index.html` at build time that you can serve and hydrate as a SPA.
Typical Single Page apps send a mostly blank `index.html` template with little more than an empty `<div id="root"></div>`. In contrast, `react-router build` (in SPA Mode) pre-renders your root route at build time into an `index.html` file. This means you can:
- Send more than an empty `<div>`
- Use a root `loader` to load data for your application shell
- Use React components to generate the initial page users see (root `HydrateFallback`)
- Re-enable server rendering later without changing anything about your UI
<docs-info>SPA Mode is a special form of "Pre-Rendering" that allows you to serve all paths in your application from the same HTML file. Please refer to the [Pre-Rendering](./pre-rendering) guide if you want to do more extensive pre-rendering.</docs-info>
## 1. Disable Runtime Server Rendering
Server rendering is enabled by default. Set the `ssr` flag to `false` in `react-router.config.ts` to disable it.
```ts filename=react-router.config.ts lines=[4]
export default {
  ssr: false,
} satisfies Config;
```
With this set to false, the server build will no longer be generated.
<docs-info>It's important to note that setting `ssr:false` only disables _runtime server rendering_. React Router will still server render your root route at _build time_ to generate the `index.html` file. This is why your project still needs a dependency on `@react-router/node` and your routes need to be SSR-safe. That means you can't call `window` or other browser-only APIs during the initial render, even when server rendering is disabled.</docs-info>
## 2. Add a `HydrateFallback` and optional `loader` to your root route
SPA Mode will generate an `index.html` file at build-time that you can serve as the entry point for your SPA. This will only render the root route so that it is capable of hydrating at runtime for any path in your application.
To provide a better loading UI than an empty `<div>`, you can add a `HydrateFallback` component to your root route to render your loading UI into the `index.html` at build time. This way, it will be shown to users immediately while the SPA is loading/hydrating.
```tsx filename=root.tsx lines=[7-9]
export function Layout() {
  return <html>{/*...*/}</html>;
}
export function HydrateFallback() {
  return <LoadingScreen />;
}
export default function App() {
  return <Outlet />;
}
```
Because the root route is server-rendered at build time, you can also use a `loader` in your root route if you choose. This `loader` will be called at build time and the data will be available via the optional `HydrateFallback` `loaderData` prop.
```tsx filename=root.tsx lines=[5,10,14]
export async function loader() {
  return {
    version: await getVersion(),
  };
}
export function HydrateFallback({
  loaderData,
}: Route.ComponentProps) {
  return (
    <div>
      <h1>Loading version {loaderData.version}...</h1>
      <AwesomeSpinner />
    </div>
  );
}
```
You cannot include a `loader` in any other routes in your app when using SPA Mode unless you are [pre-rendering those pages](./pre-rendering).
## 3. Use client loaders and client actions
With server rendering disabled, you can still use `clientLoader` and `clientAction` to manage route data and mutations.
```tsx filename=some-route.tsx
export async function clientLoader({
  params,
}: Route.ClientLoaderArgs) {
  let data = await fetch(`/some/api/stuff/${params.id}`);
  return data;
}
export async function clientAction({
  request,
}: Route.ClientActionArgs) {
  let formData = await request.formData();
  return await processPayment(formData);
}
```
## 4. Direct all URLs to index.html
After running `react-router build`, deploy the `build/client` directory to whatever static host you prefer.
Common to deploying any SPA, you'll need to configure your host to direct all URLs to the `index.html` of the client build. Some hosts do this by default, but others don't. As an example, a host may support a `_redirects` file to do this:
```
/*    /index.html   200
```
If you're getting 404s at valid routes for your app, it's likely you need to configure your host.

---

## Page 163 — `docs/how-to/status.md`

Live URL: https://reactrouter.com/how-to/status

# Status Codes
[MODES: framework ,data]
<br/>
<br/>
Set status codes from loaders and actions with `data`.
```tsx filename=app/project.tsx lines=[3,12-15,20,23]
// route('/projects/:projectId', './project.tsx')
export async function action({
  request,
}: Route.ActionArgs) {
  let formData = await request.formData();
  let title = formData.get("title");
  if (!title) {
    return data(
      { message: "Invalid title" },
      { status: 400 },
    );
  }
  if (!projectExists(title)) {
    let project = await fakeDb.createProject({ title });
    return data(project, { status: 201 });
  } else {
    let project = await fakeDb.updateProject({ title });
    // the default status code is 200, no need for `data`
    return project;
  }
}
```
See [Form Validation](./form-validation) for more information on rendering form errors like this.
Another common status code is 404:
```tsx
// route('/projects/:projectId', './project.tsx')
export async function loader({ params }: Route.ActionArgs) {
  let project = await fakeDb.getProject(params.id);
  if (!project) {
    // throw to ErrorBoundary
    throw data(null, { status: 404 });
  }
  return project;
}
```
See the [Error Boundaries](./error-boundary) for more information on thrown `data`.

---

## Page 164 — `docs/how-to/suspense.md`

Live URL: https://reactrouter.com/how-to/suspense

# Streaming with Suspense
[MODES: framework, data]
<br/>
<br/>
Streaming with React Suspense allows apps to speed up initial renders by deferring non-critical data and unblocking UI rendering.
React Router supports React Suspense by returning promises from loaders and actions.
## 1. Return a promise from loader
React Router awaits route loaders before rendering route components. To unblock the loader for non-critical data, return the promise instead of awaiting it in the loader.
```tsx
export async function loader({}: Route.LoaderArgs) {
  // note this is NOT awaited
  let nonCriticalData = new Promise((res) =>
    setTimeout(() => res("non-critical"), 5000),
  );
  let criticalData = await new Promise((res) =>
    setTimeout(() => res("critical"), 300),
  );
  return { nonCriticalData, criticalData };
}
```
Note you can't return a single promise, it must be an object with keys.
## 2. Render the fallback and resolved UI
The promise will be available on `loaderData`, `<Await>` will await the promise and trigger `<Suspense>` to render the fallback UI.
```tsx
// [previous code]
export default function MyComponent({
  loaderData,
}: Route.ComponentProps) {
  let { criticalData, nonCriticalData } = loaderData;
  return (
    <div>
      <h1>Streaming example</h1>
      <h2>Critical data value: {criticalData}</h2>
      <React.Suspense fallback={<div>Loading...</div>}>
        <Await resolve={nonCriticalData}>
          {(value) => <h3>Non critical value: {value}</h3>}
        </Await>
      </React.Suspense>
    </div>
  );
}
```
## With React 19
If you're using React 19, you can use `React.use` instead of `Await`, but you'll need to create a new component and pass the promise down to trigger the suspense fallback.
```tsx
<React.Suspense fallback={<div>Loading...</div>}>
  <NonCriticalUI p={nonCriticalData} />
</React.Suspense>
```
```tsx
function NonCriticalUI({ p }: { p: Promise<string> }) {
  let value = React.use(p);
  return <h3>Non critical value {value}</h3>;
}
```
## Timeouts
By default, loaders and actions reject any outstanding promises after 4950ms. You can control this by exporting a `streamTimeout` numerical value from your `entry.server.tsx`.
```ts filename=entry.server.tsx
// Reject all pending promises from handler functions after 10 seconds
```
## Handling early rejections (Node)
React Router waits for all loaders to settle (via `Promise.all`) before it begins streaming the response. Once streaming has started, React Router catches subsequent rejections of your streamed promises and surfaces them to your `<Await>` (or React 19 `React.use`) error UI.
However, if a streamed promise rejects _before_ all of the route's loaders have settled, React Router has not yet been able to attach a handler to it. In Node, an unhandled promise rejection will crash the process unless you have a top-level handler registered.
For example, this can happen if a parent route's loader takes longer to resolve than a child route's streamed promise takes to reject:
```tsx
// parent.tsx — slow loader
export async function loader() {
  await new Promise((r) => setTimeout(r, 1000));
  return { parent: "data" };
}
// child.tsx — fast-rejecting streamed promise
export async function loader() {
  let lazy = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("boom")), 100),
  );
  return { lazy };
}
```
When `lazy` rejects before the parent loader resolves, the rejection bubbles to the node process as an unhandled rejection, which will crash the process without a user-defined handler.
To prevent this, register a process-level `unhandledRejection` handler in your server entry:
```ts filename=entry.server.ts
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "Unhandled Rejection at:",
    promise,
    "reason:",
    reason,
  );
});
```

---

## Page 165 — `docs/how-to/using-handle.md`

Live URL: https://reactrouter.com/how-to/using-handle

# Using `handle`
[MODES: framework]
<br/>
<br/>
You can build dynamic UI elements like breadcrumbs based on your route hierarchy using the [`useMatches`][use-matches] hook and [`handle`][handle] route exports.
## Understanding the Basics
React Router provides access to all route matches and their data throughout your component tree. This allows routes to contribute metadata through the `handle` export that can be rendered by ancestor components.
The `useMatches` hook combined with `handle` exports enables routes to contribute to rendering processes higher up the component tree than their actual render point. While we'll use breadcrumbs as an example, this pattern works for any scenario where you need routes to provide additional information to their ancestors.
## Defining Route `handle`s
We'll use a route structure like the following:
```ts filename=app/routes.ts
export default [
  route("parent", "./routes/parent.tsx", [
    route("child", "./routes/child.tsx"),
  ]),
] satisfies RouteConfig;
```
Add a `breadcrumb` property to the "parent" route's `handle` export. You can name this property whatever makes sense for your use case.
```tsx filename=app/routes/parent.tsx
```
You can define breadcrumbs for child routes as well:
```tsx filename=app/routes/child.tsx
```
## Using Route `handle`s
Use the `useMatches` hook in your root layout or any ancestor component to collect and render the components defined in the `handle` export(s):
```tsx filename=app/root.tsx lines=[7,11,22-31]
export function Layout({ children }) {
  const matches = useMatches();
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <header>
          <ol>
            {matches
              .filter(
                (match) =>
                  match.handle && match.handle.breadcrumb,
              )
              .map((match, index) => (
                <li key={index}>
                  {match.handle.breadcrumb(match)}
                </li>
              ))}
          </ol>
        </header>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
export default function App() {
  return <Outlet />;
}
```
The `match` object is passed to each breadcrumb function, giving you access to `match.data` (from loaders) and other route information to create dynamic breadcrumbs based on your route's data.
This pattern provides a clean way for routes to contribute metadata that can be consumed and rendered by ancestor components.
## Additional Resources
- [`useMatches`][use-matches]
- [`handle`][handle]
[use-matches]: ../api/hooks/useMatches
[handle]: ../start/framework/route-module#handle

---

## Page 166 — `docs/how-to/view-transitions.md`

Live URL: https://reactrouter.com/how-to/view-transitions

# View Transitions
[MODES: framework, data]
<br/>
<br/>
Enable smooth animations between page transitions in your React Router applications using the [View Transitions API][view-transitions-api]. This feature allows you to create seamless visual transitions during client-side navigation.
## Basic View Transition
### 1. Enable view transitions on navigation
The simplest way to enable view transitions is by adding the `viewTransition` prop to your `Link`, `NavLink`, or `Form` components. This automatically wraps the navigation update in `document.startViewTransition()`.
```tsx
<Link to="/about" viewTransition>
  About
</Link>
```
Without any additional CSS, this provides a basic cross-fade animation between pages.
### 2. Enable view transitions with programmatic navigation
When using programmatic navigation with the `useNavigate` hook, you can enable view transitions by passing the `viewTransition: true` option:
```tsx
function NavigationButton() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() =>
        navigate("/about", { viewTransition: true })
      }
    >
      About
    </button>
  );
}
```
This provides the same cross-fade animation as using the `viewTransition` prop on Link components.
For more information on using the View Transitions API, please refer to the ["Smooth transitions with the View Transition API" guide][view-transitions-guide] from the Google Chrome team.
## Image Gallery Example
Let's build an image gallery that demonstrates how to trigger and use view transitions. We'll create a list of images that expand into a detail view with smooth animations.
### 1. Create the image gallery route
```tsx filename=routes/image-gallery.tsx
export default function ImageGalleryRoute() {
  return (
    <div className="image-list">
      <h1>Image List</h1>
      <div>
        {images.map((src, idx) => (
          <NavLink
            key={src}
            to={`/image/${idx}`}
            viewTransition // Enable view transitions for this link
          >
            <p>Image Number {idx}</p>
            <img
              className="max-w-full contain-layout"
              src={src}
            />
          </NavLink>
        ))}
      </div>
    </div>
  );
}
```
### 2. Add transition styles
Define view transition names and animations for elements that should transition smoothly between routes.
```css filename=app.css
/* Layout styles for the image grid */
.image-list > div {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  column-gap: 10px;
}
.image-list h1 {
  font-size: 2rem;
  font-weight: 600;
}
.image-list img {
  max-width: 100%;
  contain: layout;
}
.image-list p {
  width: fit-content;
}
/* Assign transition names to elements during navigation */
.image-list a.transitioning img {
  view-transition-name: image-expand;
}
.image-list a.transitioning p {
  view-transition-name: image-title;
}
```
### 3. Create the image detail route
The detail view needs to use the same view transition names to create a seamless animation.
```tsx filename=routes/image-details.tsx
export default function ImageDetailsRoute({
  params,
}: Route.ComponentProps) {
  return (
    <div className="image-detail">
      <Link to="/" viewTransition>
        Back
      </Link>
      <h1>Image Number {params.id}</h1>
      <img src={images[Number(params.id)]} />
    </div>
  );
}
```
### 4. Add matching transition styles for the detail view
```css filename=app.css
/* Match transition names from the list view */
.image-detail h1 {
  font-size: 2rem;
  font-weight: 600;
  width: fit-content;
  view-transition-name: image-title;
}
.image-detail img {
  max-width: 100%;
  contain: layout;
  view-transition-name: image-expand;
}
```
## Advanced Usage
You can control view transitions more precisely using either render props or the `useViewTransitionState` hook.
### 1. Using render props
```tsx filename=routes/image-gallery.tsx
<NavLink to={`/image/${idx}`} viewTransition>
  {({ isTransitioning }) => (
    <>
      <p
        style={{
          viewTransitionName: isTransitioning
            ? "image-title"
            : "none",
        }}
      >
        Image Number {idx}
      </p>
      <img
        src={src}
        style={{
          viewTransitionName: isTransitioning
            ? "image-expand"
            : "none",
        }}
      />
    </>
  )}
</NavLink>
```
### 2. Using the `useViewTransitionState` hook
```tsx filename=routes/image-gallery.tsx
function NavImage(props: { src: string; idx: number }) {
  const href = `/image/${props.idx}`;
  // Hook provides transition state for specific route
  const isTransitioning = useViewTransitionState(href);
  return (
    <Link to={href} viewTransition>
      <p
        style={{
          viewTransitionName: isTransitioning
            ? "image-title"
            : "none",
        }}
      >
        Image Number {props.idx}
      </p>
      <img
        src={props.src}
        style={{
          viewTransitionName: isTransitioning
            ? "image-expand"
            : "none",
        }}
      />
    </Link>
  );
}
```
[view-transitions-api]: https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition
[view-transitions-guide]: https://developer.chrome.com/docs/web-platform/view-transitions

---

## Page 167 — `docs/how-to/webhook.md`

Live URL: https://reactrouter.com/how-to/webhook

# Webhooks
Resource routes can be used to handle webhooks. For example, you can create a webhook that receives notifications from GitHub when a new commit is pushed to a repository:
```tsx
  }
  const payload = await request.json();
  /* Validate the webhook */
  const signature = request.headers.get(
    "X-Hub-Signature-256",
  );
  const generatedSignature = `sha256=${crypto
    .createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex")}`;
  if (signature !== generatedSignature) {
    return Response.json(
      { message: "Signature mismatch" },
      {
        status: 401,
      },
    );
  }
  /* process the webhook (e.g. enqueue a background job) */
  return Response.json({ success: true });
};
```

---

## Page 168 — `docs/index.md`

Live URL: https://reactrouter.com/index

# React Router Home
React Router is a multi-strategy router for React bridging the gap from React 18 to React 19. You can use it maximally as a React framework or as minimally as you want.
## Getting Started
There are three primary ways, or "modes", to use it in your app, so there are three guides to get you started.
- [Declarative](./start/declarative/installation)
- [Data](./start/data/installation)
- [Framework](./start/framework/installation)
Learn which mode is right for you in [Picking a Mode](./start/modes).
## Using These Guides
Across the docs you'll see the following icons:
[MODES: framework, data, declarative]
<p></p>
These icons indicate which mode the content is relevant to.
Additional auto-generated reference documentation is available:
[Autogenerated Reference Docs ↗](https://api.reactrouter.com/v7/)
## Upgrading
If you are caught up on future flags, upgrading from React Router v6 or Remix v2 is generally non-breaking. Remix v2 apps are encouraged to upgrade to React Router v7.
- [Upgrade from v6](./upgrading/v6)
- [Upgrade from Remix](./upgrading/remix)

---

## Page 169 — `docs/start/data/actions.md`

Live URL: https://reactrouter.com/start/data/actions

# Actions
[MODES: data]
## Defining Actions
Data mutations are done through Route actions defined on the `action` property of a route object. When the action completes, all loader data on the page is revalidated to keep your UI in sync with the data without writing any code to do it.
```tsx
let router = createBrowserRouter([
  {
    path: "/projects/:projectId",
    Component: Project,
    action: async ({ request }) => {
      let formData = await request.formData();
      let title = formData.get("title");
      let project = await someApi.updateProject({ title });
      return project;
    },
  },
]);
```
## Calling Actions
Actions are called declaratively through `<Form>` and imperatively through `useSubmit` (or `<fetcher.Form>` and `fetcher.submit`) by referencing the route's path and a "post" method.
### Calling actions with a Form
```tsx
function SomeComponent() {
  return (
    <Form action="/projects/123" method="post">
      <input type="text" name="title" />
      <button type="submit">Submit</button>
    </Form>
  );
}
```
This will cause a navigation and a new entry will be added to the browser history.
### Calling actions with useSubmit
You can submit form data to an action imperatively with `useSubmit`.
```tsx
function useQuizTimer() {
  let submit = useSubmit();
  let cb = useCallback(() => {
    submit(
      { quizTimedOut: true },
      { action: "/end-quiz", method: "post" },
    );
  }, []);
  let tenMinutes = 10 * 60 * 1000;
  useFakeTimer(tenMinutes, cb);
}
```
This will cause a navigation and a new entry will be added to the browser history.
### Calling actions with a fetcher
Fetchers allow you to submit data to actions (and loaders) without causing a navigation (no new entries in the browser history).
```tsx
function Task() {
  let fetcher = useFetcher();
  let busy = fetcher.state !== "idle";
  return (
    <fetcher.Form method="post" action="/update-task/123">
      <input type="text" name="title" />
      <button type="submit">
        {busy ? "Saving..." : "Save"}
      </button>
    </fetcher.Form>
  );
}
```
They also have the imperative `submit` method.
```tsx
fetcher.submit(
  { title: "New Title" },
  { action: "/update-task/123", method: "post" },
);
```
See the [Using Fetchers][fetchers] guide for more information.
## Accessing Action Data
Actions can return data available through `useActionData` in the route component or `fetcher.data` when using a fetcher.
```tsx
function Project() {
  let actionData = useActionData();
  return (
    <div>
      <h1>Project</h1>
      <Form method="post">
        <input type="text" name="title" />
        <button type="submit">Submit</button>
      </Form>
      {actionData ? (
        <p>{actionData.title} updated</p>
      ) : null}
    </div>
  );
}
```
---
Next: [Navigating](./navigating)
[fetchers]: ../../how-to/fetchers

---

## Page 170 — `docs/start/data/custom.md`

Live URL: https://reactrouter.com/start/data/custom

# Custom Framework
[MODES: data]
## Introduction
Instead of using `@react-router/dev`, you can integrate React Router's framework features (like loaders, actions, fetchers, etc.) into your own bundler and server abstractions with Data Mode.
## Client Rendering
### 1. Create a Router
The browser runtime API that enables route module APIs (loaders, actions, etc.) is `createBrowserRouter`.
It takes an array of route objects that support loaders, actions, error boundaries and more. The React Router Vite plugin creates one of these from `routes.ts`, but you can create one manually (or with an abstraction) and use your own bundler.
```tsx
let router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      {
        path: "shows/:showId",
        Component: Show,
        loader: ({ request, params }) =>
          fetch(`/api/show/${params.showId}.json`, {
            signal: request.signal,
          }),
      },
    ],
  },
]);
```
### 2. Render the Router
To render the router in the browser, use `<RouterProvider>`.
```tsx
createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />,
);
```
### 3. Lazy Loading
Routes can take most of their definition lazily with the `lazy` property.
```tsx
createBrowserRouter([
  {
    path: "/show/:showId",
    lazy: {
      loader: async () =>
        (await import("./show.loader.js")).loader,
      action: async () =>
        (await import("./show.action.js")).action,
      Component: async () =>
        (await import("./show.component.js")).Component,
    },
  },
]);
```
## Server Rendering
To server render a custom setup, there are a few server APIs available for rendering and data loading.
This guide simply gives you some ideas about how it works. For deeper understanding, please see the [Custom Framework Example Repo](https://github.com/remix-run/custom-react-router-framework-example)
### 1. Define Your Routes
Routes are the same kinds of objects on the server as the client.
```tsx
export default [
  {
    path: "/",
    Component: Root,
    children: [
      {
        path: "shows/:showId",
        Component: Show,
        loader: ({ params }) => {
          return db.loadShow(params.id);
        },
      },
    ],
  },
];
```
### 2. Create a static handler
Turn your routes into a request handler with `createStaticHandler`:
```tsx
let { query, dataRoutes } = createStaticHandler(routes);
```
### 3. Get Routing Context and Render
React Router works with web fetch [Requests](https://developer.mozilla.org/en-US/docs/Web/API/Request), so if your server doesn't, you'll need to adapt whatever objects it uses to a web fetch `Request` object.
This step assumes your server receives `Request` objects.
```tsx
let { query, dataRoutes } = createStaticHandler(routes);
export async function handler(request: Request) {
  // 1. run actions/loaders to get the routing context with `query`
  let context = await query(request);
  // If `query` returns a Response, send it raw (a route probably a redirected)
  if (context instanceof Response) {
    return context;
  }
  // 2. Create a static router for SSR
  let router = createStaticRouter(dataRoutes, context);
  // 3. Render everything with StaticRouterProvider
  let html = renderToString(
    <StaticRouterProvider
      router={router}
      context={context}
    />,
  );
  // Setup headers from action and loaders from deepest match
  let leaf = context.matches[context.matches.length - 1];
  let actionHeaders = context.actionHeaders[leaf.route.id];
  let loaderHeaders = context.loaderHeaders[leaf.route.id];
  let headers = new Headers(actionHeaders);
  if (loaderHeaders) {
    for (let [key, value] of loaderHeaders.entries()) {
      headers.append(key, value);
    }
  }
  headers.set("Content-Type", "text/html; charset=utf-8");
  // 4. send a response
  return new Response(`<!DOCTYPE html>${html}`, {
    status: context.statusCode,
    headers,
  });
}
```
### 4. Hydrate in the browser
Hydration data is embedded onto `window.__staticRouterHydrationData`, use that to initialize your client side router and render a `<RouterProvider>`.
```tsx
let router = createBrowserRouter(routes, {
  hydrationData: window.__staticRouterHydrationData,
});
hydrateRoot(
  document,
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

---

## Page 171 — `docs/start/data/data-loading.md`

Live URL: https://reactrouter.com/start/data/data-loading

# Data Loading
[MODES: data]
## Providing Data
Data is provided to route components from route loaders:
```tsx
createBrowserRouter([
  {
    path: "/",
    loader: async () => {
      // return data from here
      return { records: await getSomeRecords() };
    },
    Component: MyRoute,
  },
]);
```
## Accessing Data
The data is available in route components with `useLoaderData`.
```tsx
function MyRoute() {
  const { records } = useLoaderData();
  return <div>{records.length}</div>;
}
```
As the user navigates between routes, the loaders are called before the route component is rendered.
---
Next: [Actions](./actions)

---

## Page 172 — `docs/start/data/index.md`

Live URL: https://reactrouter.com/start/data/index



---

## Page 173 — `docs/start/data/installation.md`

Live URL: https://reactrouter.com/start/data/installation

# Installation
[MODES: data]
## Bootstrap with a Bundler Template
You can start with a React template from Vite and choose "React", otherwise bootstrap your application however you prefer (Parcel, Webpack, etc).
```shellscript nonumber
npx create-vite@latest
```
## Install React Router
Next install React Router from npm:
```shellscript nonumber
npm i react-router
```
## Create a Router and Render
Create a router and pass it to `RouterProvider`:
```tsx lines=[3-4,6-11,16]
const router = createBrowserRouter([
  {
    path: "/",
    element: <div>Hello World</div>,
  },
]);
const root = document.getElementById("root");
ReactDOM.createRoot(root).render(
  <RouterProvider router={router} />,
);
```
---
Next: [Routing](./routing)

---

## Page 174 — `docs/start/data/navigating.md`

Live URL: https://reactrouter.com/start/data/navigating

# Navigating
Navigating in Data Mode is the same as Framework Mode, please see the [Navigating](../framework/navigating) guide for more information.
---
Next: [Pending UI](./pending-ui)

---

## Page 175 — `docs/start/data/pending-ui.md`

Live URL: https://reactrouter.com/start/data/pending-ui

# Pending UI
Pending UI is the same as Framework Mode, please see the [Pending UI](../framework/pending-ui) guide for more information.
---
Next: [Custom Framework](./custom)

---

## Page 176 — `docs/start/data/route-object.md`

Live URL: https://reactrouter.com/start/data/route-object

# Route Object
[MODES: data]
## Introduction
The objects passed to `createBrowserRouter` are called Route Objects.
```tsx lines=[2-5]
createBrowserRouter([
  {
    path: "/",
    Component: App,
  },
]);
```
Route modules are the foundation of React Router's data features, they define:
- data loading
- actions
- revalidation
- error boundaries
- and more
This guide is a quick overview of every route object feature.
## Component
The `Component` property in a route object defines the component that will render when the route matches.
```tsx lines=[4]
createBrowserRouter([
  {
    path: "/",
    Component: MyRouteComponent,
  },
]);
function MyRouteComponent() {
  return (
    <div>
      <h1>Look ma!</h1>
      <p>
        I'm still using React Router after like 10 years.
      </p>
    </div>
  );
}
```
## `middleware`
Route [middleware][middleware] runs sequentially before and after navigations. This gives you a singular place to do things like logging and authentication. The `next` function continues down the chain, and on the leaf route the `next` function executes the loaders/actions for the navigation.
```tsx
createBrowserRouter([
  {
    path: "/",
    middleware: [loggingMiddleware],
    loader: rootLoader,
    Component: Root,
    children: [{
      path: 'auth',
      middleware: [authMiddleware],
      loader: authLoader,
      Component: Auth,
      children: [...]
    }]
  },
]);
async function loggingMiddleware({ request }, next) {
  let url = new URL(request.url);
  console.log(`Starting navigation: ${url.pathname}${url.search}`);
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  console.log(`Navigation completed in ${duration}ms`);
}
const userContext = createContext<User>();
async function authMiddleware ({ context }) {
  const userId = getUserId();
  if (!userId) {
    throw redirect("/login");
  }
  context.set(userContext, await getUserById(userId));
};
```
See also:
- [Middleware][middleware]
## `loader`
Route loaders provide data to route components before they are rendered.
```tsx
createBrowserRouter([
  {
    path: "/",
    loader: loader,
    Component: MyRoute,
  },
]);
async function loader({ params }) {
  return { message: "Hello, world!" };
}
function MyRoute() {
  let data = useLoaderData();
  return <h1>{data.message}</h1>;
}
```
See also:
- [`loader` params][loader-params]
## `action`
Route actions allow server-side data mutations with automatic revalidation of all loader data on the page when called from `<Form>`, `useFetcher`, and `useSubmit`.
```tsx
createBrowserRouter([
  {
    path: "/items",
    action: action,
    loader: loader,
    Component: Items,
  },
]);
async function action({ request }) {
  const data = await request.formData();
  const todo = await fakeDb.addItem({
    title: data.get("title"),
  });
  return { ok: true };
}
// this data will be revalidated after the action completes...
async function loader() {
  const items = await fakeDb.getItems();
  return { items };
}
// ...so that the list here is updated automatically
export default function Items() {
  let data = useLoaderData();
  return (
    <div>
      <List items={data.items} />
      <Form method="post" navigate={false}>
        <input type="text" name="title" />
        <button type="submit">Create Todo</button>
      </Form>
    </div>
  );
}
```
## `shouldRevalidate`
Loader data is automatically revalidated after certain events like navigations and form submissions.
This hook enables you to opt in or out of the default revalidation behavior. The default behavior is nuanced to avoid calling loaders unnecessarily.
A route loader is revalidated when:
- its own route params change
- any change to URL search params
- after an action is called and returns a non-error status code
By defining this function, you opt out of the default behavior completely and can manually control when loader data is revalidated for navigations and form submissions.
```tsx
function shouldRevalidate(
  arg: ShouldRevalidateFunctionArgs,
) {
  return true; // false
}
createBrowserRouter([
  {
    path: "/",
    shouldRevalidate: shouldRevalidate,
    Component: MyRoute,
  },
]);
```
[`ShouldRevalidateFunctionArgs` Reference Documentation ↗](https://api.reactrouter.com/v7/interfaces/react-router.ShouldRevalidateFunctionArgs.html)
Please note the default behavior is different in [Framework Mode](../modes).
## `lazy`
Most properties can be lazily imported to reduce the initial bundle size.
```tsx
createBrowserRouter([
  {
    path: "/app",
    lazy: async () => {
      // load component and loader in parallel before rendering
      const [Component, loader] = await Promise.all([
        import("./app"),
        import("./app-loader"),
      ]);
      return { Component, loader };
    },
  },
]);
```
---
Next: [Data Loading](./data-loading)
[loader-params]: https://api.reactrouter.com/v7/interfaces/react-router.LoaderFunctionArgs
[middleware]: ../../how-to/middleware

---

## Page 177 — `docs/start/data/routing.md`

Live URL: https://reactrouter.com/start/data/routing

# Routing
[MODES: data]
## Configuring Routes
Routes are configured as the first argument to `createBrowserRouter`. At a minimum, you need a path and component:
```tsx
function Root() {
  return <h1>Hello world</h1>;
}
const router = createBrowserRouter([
  { path: "/", Component: Root },
]);
```
Here is a larger sample route config:
```ts filename=app/routes.ts
createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "about", Component: About },
      {
        path: "auth",
        Component: AuthLayout,
        children: [
          { path: "login", Component: Login },
          { path: "register", Component: Register },
        ],
      },
      {
        path: "concerts",
        children: [
          { index: true, Component: ConcertsHome },
          { path: ":city", Component: ConcertsCity },
          { path: "trending", Component: ConcertsTrending },
        ],
      },
    ],
  },
]);
```
## Route Objects
Route objects define the behavior of a route beyond just the path and component, like data loading and actions. We'll go into more detail in the [Route Object guide](./route-object), but here's a quick example of a loader.
```tsx filename=app/team.tsx
createBrowserRouter([
  {
    path: "/teams/:teamId",
    loader: async ({ params }) => {
      let team = await fetchTeam(params.teamId);
      return { name: team.name };
    },
    Component: Team,
  },
]);
function Team() {
  let data = useLoaderData();
  return <h1>{data.name}</h1>;
}
```
## Nested Routes
Routes can be nested inside parent routes through `children`.
```ts filename=app/routes.ts
createBrowserRouter([
  {
    path: "/dashboard",
    Component: Dashboard,
    children: [
      { index: true, Component: Home },
      { path: "settings", Component: Settings },
    ],
  },
]);
```
The path of the parent is automatically included in the child, so this config creates both `"/dashboard"` and `"/dashboard/settings"` URLs.
Child routes are rendered through the `<Outlet/>` in the parent route.
```tsx filename=app/dashboard.tsx
export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      {/* will either be <Home> or <Settings> */}
      <Outlet />
    </div>
  );
}
```
## Layout Routes
Omitting the `path` in a route creates new [Nested Routes](#nested-routes) for its children without adding any segments to the URL.
```tsx lines=[3,16]
createBrowserRouter([
  {
    // no path on this parent route, just the component
    Component: MarketingLayout,
    children: [
      { index: true, Component: Home },
      { path: "contact", Component: Contact },
    ],
  },
  {
    path: "projects",
    children: [
      { index: true, Component: ProjectsHome },
      {
        // again, no path, just a component for the layout
        Component: ProjectLayout,
        children: [
          { path: ":pid", Component: Project },
          { path: ":pid/edit", Component: EditProject },
        ],
      },
    ],
  },
]);
```
Note that:
- `Home` and `Contact` will be rendered into the `MarketingLayout` outlet
- `Project` and `EditProject` will be rendered into the `ProjectLayout` outlet while `ProjectsHome` will not.
## Index Routes
Index routes are defined by setting `index: true` on a route object without a path.
```ts
{ index: true, Component: Home }
```
Index routes render into their parent's [Outlet][outlet] at their parent's URL (like a default child route).
```ts lines=[4,5,10,11]
createBrowserRouter([
  // renders at "/"
  { index: true, Component: Home },
  {
    Component: Dashboard,
    path: "/dashboard",
    children: [
      // renders at "/dashboard"
      { index: true, Component: DashboardHome },
      { path: "settings", Component: DashboardSettings },
    ],
  },
]);
```
Note that index routes can't have children.
## Prefix Route
A route with just a path and no component creates a group of routes with a path prefix.
```tsx lines=[3]
createBrowserRouter([
  {
    // no component, just a path
    path: "/projects",
    children: [
      { index: true, Component: ProjectsHome },
      { path: ":pid", Component: Project },
      { path: ":pid/edit", Component: EditProject },
    ],
  },
]);
```
This creates the routes `/projects`, `/projects/:pid`, and `/projects/:pid/edit` without introducing a layout component.
## Dynamic Segments
If a path segment starts with `:` then it becomes a "dynamic segment". When the route matches the URL, the dynamic segment will be parsed from the URL and provided as `params` to other router APIs.
```ts lines=[2]
{
  path: "teams/:teamId",
  loader: async ({ params }) => {
    // params are available in loaders/actions
    let team = await fetchTeam(params.teamId);
    return { name: team.name };
  },
  Component: Team,
}
```
```tsx
function Team() {
  // params are available in components through useParams
  let params = useParams();
  // ...
}
```
You can have multiple dynamic segments in one route path:
```ts
{
  path: "c/:categoryId/p/:productId";
}
```
## Optional Segments
You can make a route segment optional by adding a `?` to the end of the segment.
```ts
{
  path: ":lang?/categories";
}
```
You can have optional static segments, too:
```ts
{
  path: "users/:userId/edit?";
}
```
## Splats
Also known as "catchall" and "star" segments. If a route path pattern ends with `/*` then it will match any characters following the `/`, including other `/` characters.
```ts
{
  path: "files/*";
  loader: async ({ params }) => {
    params["*"]; // will contain the remaining URL after files/
  };
}
```
You can destructure the `*`, you just have to assign it a new name. A common name is `splat`:
```tsx
const { "*": splat } = params;
```
---
Next: [Route Object](./route-object)
[outlet]: https://api.reactrouter.com/v7/functions/react-router.Outlet.html

---

## Page 178 — `docs/start/data/testing.md`

Live URL: https://reactrouter.com/start/data/testing

# Testing
You can use `createRoutesStub` in data and framework modes. Please refer to the [Testing Guide](../framework/testing).

---

## Page 179 — `docs/start/declarative/index.md`

Live URL: https://reactrouter.com/start/declarative/index



---

## Page 180 — `docs/start/declarative/installation.md`

Live URL: https://reactrouter.com/start/declarative/installation

# Installation
[MODES: declarative]
## Introduction
You can start with a React template from Vite and choose "React", otherwise bootstrap your application however you prefer.
```shellscript nonumber
npx create-vite@latest
```
Next install React Router from npm:
```shellscript nonumber
npm i react-router
```
Finally, render a `<BrowserRouter>` around your application:
```tsx lines=[3,9-11]
const root = document.getElementById("root");
ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
```
---
Next: [Routing](./routing)

---

## Page 181 — `docs/start/declarative/navigating.md`

Live URL: https://reactrouter.com/start/declarative/navigating

# Navigating
[MODES: declarative]
## Introduction
Users navigate your application with `<Link>`, `<NavLink>`, and `useNavigate`.
## NavLink
This component is for navigation links that need to render an active state.
```tsx
export function MyAppNav() {
  return (
    <nav>
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/trending" end>
        Trending Concerts
      </NavLink>
      <NavLink to="/concerts">All Concerts</NavLink>
      <NavLink to="/account">Account</NavLink>
    </nav>
  );
}
```
Whenever a `NavLink` is active, it will automatically have an `.active` class name for easy styling with CSS:
```css
a.active {
  color: red;
}
```
It also has callback props on `className`, `style`, and `children` with the active state for inline styling or conditional rendering:
```tsx
// className
<NavLink
  to="/messages"
  className={({ isActive }) =>
    isActive ? "text-red-500" : "text-black"
  }
>
  Messages
</NavLink>
```
```tsx
// style
<NavLink
  to="/messages"
  style={({ isActive }) => ({
    color: isActive ? "red" : "black",
  })}
>
  Messages
</NavLink>
```
```tsx
// children
<NavLink to="/message">
  {({ isActive }) => (
    <span className={isActive ? "active" : ""}>
      {isActive ? "👉" : ""} Tasks
    </span>
  )}
</NavLink>
```
## Link
Use `<Link>` when the link doesn't need active styling:
```tsx
export function LoggedOutMessage() {
  return (
    <p>
      You've been logged out.{" "}
      <Link to="/login">Login again</Link>
    </p>
  );
}
```
## useNavigate
This hook allows the programmer to navigate the user to a new page without the user interacting.
For normal navigation, it's best to use `Link` or `NavLink`. They provide a better default user experience like keyboard events, accessibility labeling, "open in new window", right click context menus, etc.
Reserve usage of `useNavigate` to situations where the user is _not_ interacting but you need to navigate, for example:
- After a form submission completes
- Logging them out after inactivity
- Timed UIs like quizzes, etc.
```tsx
export function LoginPage() {
  let navigate = useNavigate();
  return (
    <>
      <MyHeader />
      <MyLoginForm
        onSuccess={() => {
          navigate("/dashboard");
        }}
      />
      <MyFooter />
    </>
  );
}
```
---
Next: [Url values](./url-values)

---

## Page 182 — `docs/start/declarative/routing.md`

Live URL: https://reactrouter.com/start/declarative/routing

# Routing
[MODES: declarative]
## Configuring Routes
Routes are configured by rendering `<Routes>` and `<Route>` that couple URL segments to UI elements.
```tsx
const root = document.getElementById("root");
ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
    </Routes>
  </BrowserRouter>,
);
```
Here's a larger sample config:
```tsx
<Routes>
  <Route index element={<Home />} />
  <Route path="about" element={<About />} />
  <Route element={<AuthLayout />}>
    <Route path="login" element={<Login />} />
    <Route path="register" element={<Register />} />
  </Route>
  <Route path="concerts">
    <Route index element={<ConcertsHome />} />
    <Route path=":city" element={<City />} />
    <Route path="trending" element={<Trending />} />
  </Route>
</Routes>
```
## Nested Routes
Routes can be nested inside parent routes.
```tsx
<Routes>
  <Route path="dashboard" element={<Dashboard />}>
    <Route index element={<Home />} />
    <Route path="settings" element={<Settings />} />
  </Route>
</Routes>
```
The path of the parent is automatically included in the child, so this config creates both `"/dashboard"` and `"/dashboard/settings"` URLs.
Child routes are rendered through the `<Outlet/>` in the parent route.
```tsx filename=app/dashboard.tsx
export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      {/* will either be <Home/> or <Settings/> */}
      <Outlet />
    </div>
  );
}
```
## Layout Routes
Routes _without_ a `path` create new nesting for their children, but they don't add any segments to the URL.
```tsx lines=[2,9]
<Routes>
  <Route element={<MarketingLayout />}>
    <Route index element={<MarketingHome />} />
    <Route path="contact" element={<Contact />} />
  </Route>
  <Route path="projects">
    <Route index element={<ProjectsHome />} />
    <Route element={<ProjectsLayout />}>
      <Route path=":pid" element={<Project />} />
      <Route path=":pid/edit" element={<EditProject />} />
    </Route>
  </Route>
</Routes>
```
## Index Routes
Index routes render into their parent's `<Outlet/>` at their parent's URL (like a default child route). They are configured with the `index` prop:
```tsx lines=[4,8]
<Routes>
  <Route path="/" element={<Root />}>
    {/* renders into the outlet in <Root> at "/" */}
    <Route index element={<Home />} />
    <Route path="dashboard" element={<Dashboard />}>
      {/* renders into the outlet in <Dashboard> at "/dashboard" */}
      <Route index element={<DashboardHome />} />
      <Route path="settings" element={<Settings />} />
    </Route>
  </Route>
</Routes>
```
Note that index routes can't have children. If you're expecting that behavior, you probably want a [layout route](#layout-routes).
## Route Prefixes
A `<Route path>` _without_ an `element` prop adds a path prefix to its child routes, without introducing a parent layout.
```tsx filename=app/routes.ts lines=[1]
<Route path="projects">
  <Route index element={<ProjectsHome />} />
  <Route element={<ProjectsLayout />}>
    <Route path=":pid" element={<Project />} />
    <Route path=":pid/edit" element={<EditProject />} />
  </Route>
</Route>
```
## Dynamic Segments
If a path segment starts with `:` then it becomes a "dynamic segment". When the route matches the URL, the dynamic segment will be parsed from the URL and provided as `params` to other router APIs like `useParams`.
```tsx
<Route path="teams/:teamId" element={<Team />} />
```
```tsx filename=app/team.tsx
export default function Team() {
  let params = useParams();
  // params.teamId
}
```
You can have multiple dynamic segments in one route path:
```tsx
<Route
  path="/c/:categoryId/p/:productId"
  element={<Product />}
/>
```
```tsx filename=app/category-product.tsx
export default function CategoryProduct() {
  let { categoryId, productId } = useParams();
  // ...
}
```
You should ensure that all dynamic segments in a given path are unique. Otherwise, as the `params` object is populated - latter dynamic segment values will override earlier values.
## Optional Segments
You can make a route segment optional by adding a `?` to the end of the segment.
```tsx
<Route path=":lang?/categories" element={<Categories />} />
```
You can have optional static segments, too:
```tsx
<Route path="users/:userId/edit?" element={<User />} />
```
## Splats
Also known as "catchall" and "star" segments. If a route path pattern ends with `/*` then it will match any characters following the `/`, including other `/` characters.
```tsx
<Route path="files/*" element={<File />} />
```
```tsx
let params = useParams();
// params["*"] will contain the remaining URL after files/
let filePath = params["*"];
```
You can destructure the `*`, you just have to assign it a new name. A common name is `splat`:
```tsx
let { "*": splat } = useParams();
```
## Linking
Link to routes from your UI with `Link` and `NavLink`
```tsx
function Header() {
  return (
    <nav>
      {/* NavLink makes it easy to show active states */}
      <NavLink
        to="/"
        className={({ isActive }) =>
          isActive ? "active" : ""
        }
      >
        Home
      </NavLink>
      <Link to="/concerts/salt-lake-city">Concerts</Link>
    </nav>
  );
}
```
---
Next: [Navigating](./navigating)

---

## Page 183 — `docs/start/declarative/url-values.md`

Live URL: https://reactrouter.com/start/declarative/url-values

# URL Values
[MODES: declarative]
## Route Params
Route params are the parsed values from a dynamic segment.
```tsx
<Route path="/concerts/:city" element={<City />} />
```
In this case, `:city` is the dynamic segment. The parsed value for that city will be available from `useParams`
```tsx
function City() {
  let { city } = useParams();
  let data = useFakeDataLibrary(`/api/v2/cities/${city}`);
  // ...
}
```
## URL Search Params
Search params are the values after a `?` in the URL. They are accessible from `useSearchParams`, which returns an instance of [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)
```tsx
function SearchResults() {
  let [searchParams] = useSearchParams();
  return (
    <div>
      <p>
        You searched for <i>{searchParams.get("q")}</i>
      </p>
      <FakeSearchResults />
    </div>
  );
}
```
## Location Object
React Router creates a custom `location` object with some useful information on it accessible with `useLocation`.
```tsx
function useAnalytics() {
  let location = useLocation();
  useEffect(() => {
    sendFakeAnalytics(location.pathname);
  }, [location]);
}
function useScrollRestoration() {
  let location = useLocation();
  useEffect(() => {
    fakeRestoreScroll(location.key);
  }, [location]);
}
```

---

## Page 184 — `docs/start/framework/actions.md`

Live URL: https://reactrouter.com/start/framework/actions

# Actions
[MODES: framework]
## Introduction
Data mutations are done through Route actions. When the action completes, all loader data on the page is revalidated to keep your UI in sync with the data without writing any code to do it.
Route actions defined with `action` are only called on the server while actions defined with `clientAction` are run in the browser.
## Client Actions
Client actions only run in the browser and take priority over a server action when both are defined.
```tsx filename=app/project.tsx
// route('/projects/:projectId', './project.tsx')
export async function clientAction({
  request,
}: Route.ClientActionArgs) {
  let formData = await request.formData();
  let title = formData.get("title");
  let project = await someApi.updateProject({ title });
  return project;
}
export default function Project({
  actionData,
}: Route.ComponentProps) {
  return (
    <div>
      <h1>Project</h1>
      <Form method="post">
        <input type="text" name="title" />
        <button type="submit">Submit</button>
      </Form>
      {actionData ? (
        <p>{actionData.title} updated</p>
      ) : null}
    </div>
  );
}
```
## Server Actions
Server actions only run on the server and are removed from client bundles.
```tsx filename=app/project.tsx
// route('/projects/:projectId', './project.tsx')
export async function action({
  request,
}: Route.ActionArgs) {
  let formData = await request.formData();
  let title = formData.get("title");
  let project = await fakeDb.updateProject({ title });
  return project;
}
export default function Project({
  actionData,
}: Route.ComponentProps) {
  return (
    <div>
      <h1>Project</h1>
      <Form method="post">
        <input type="text" name="title" />
        <button type="submit">Submit</button>
      </Form>
      {actionData ? (
        <p>{actionData.title} updated</p>
      ) : null}
    </div>
  );
}
```
## Calling Actions
Actions are called declaratively through `<Form>` and imperatively through `useSubmit` (or `<fetcher.Form>` and `fetcher.submit`) by referencing the route's path and a "post" method.
### Calling actions with a Form
```tsx
function SomeComponent() {
  return (
    <Form action="/projects/123" method="post">
      <input type="text" name="title" />
      <button type="submit">Submit</button>
    </Form>
  );
}
```
This will cause a navigation and a new entry will be added to the browser history.
### Calling actions with useSubmit
You can submit form data to an action imperatively with `useSubmit`.
```tsx
function useQuizTimer() {
  let submit = useSubmit();
  let cb = useCallback(() => {
    submit(
      { quizTimedOut: true },
      { action: "/end-quiz", method: "post" },
    );
  }, []);
  let tenMinutes = 10 * 60 * 1000;
  useFakeTimer(tenMinutes, cb);
}
```
This will cause a navigation and a new entry will be added to the browser history.
### Calling actions with a fetcher
Fetchers allow you to submit data to actions (and loaders) without causing a navigation (no new entries in the browser history).
```tsx
function Task() {
  let fetcher = useFetcher();
  let busy = fetcher.state !== "idle";
  return (
    <fetcher.Form method="post" action="/update-task/123">
      <input type="text" name="title" />
      <button type="submit">
        {busy ? "Saving..." : "Save"}
      </button>
    </fetcher.Form>
  );
}
```
They also have the imperative `submit` method.
```tsx
fetcher.submit(
  { title: "New Title" },
  { action: "/update-task/123", method: "post" },
);
```
See the [Using Fetchers][fetchers] guide for more information.
---
Next: [Navigating](./navigating)
[fetchers]: ../../how-to/fetchers
[data]: ../../api/react-router/data

---

## Page 185 — `docs/start/framework/data-loading.md`

Live URL: https://reactrouter.com/start/framework/data-loading

# Data Loading
[MODES: framework]
## Introduction
Data is provided to the route component from `loader` and `clientLoader`.
Loader data is automatically serialized from loaders and deserialized in components. In addition to primitive values like strings and numbers, loaders can return promises, maps, sets, dates and more.
The type for the `loaderData` prop is [automatically generated][type-safety].
<docs-info>We try to support the same set of [serializable types][serializable-types] that React permits server components to pass as props to client components. This future proofs your application for any eventual migration to [RSC][rsc].</docs-info>
## Client Data Loading
`clientLoader` is used to fetch data on the client. This is useful for pages or full projects that you'd prefer to fetch data from the browser only.
```tsx filename=app/product.tsx
// route("products/:pid", "./product.tsx");
export async function clientLoader({
  params,
}: Route.ClientLoaderArgs) {
  const res = await fetch(`/api/products/${params.pid}`);
  const product = await res.json();
  return product;
}
// HydrateFallback is rendered while the client loader is running
export function HydrateFallback() {
  return <div>Loading...</div>;
}
export default function Product({
  loaderData,
}: Route.ComponentProps) {
  const { name, description } = loaderData;
  return (
    <div>
      <h1>{name}</h1>
      <p>{description}</p>
    </div>
  );
}
```
## Server Data Loading
When server rendering, `loader` is used for both initial page loads and client navigations. Client navigations call the loader through an automatic `fetch` by React Router from the browser to your server.
```tsx filename=app/product.tsx
// route("products/:pid", "./product.tsx");
export async function loader({ params }: Route.LoaderArgs) {
  const product = await fakeDb.getProduct(params.pid);
  return product;
}
export default function Product({
  loaderData,
}: Route.ComponentProps) {
  const { name, description } = loaderData;
  return (
    <div>
      <h1>{name}</h1>
      <p>{description}</p>
    </div>
  );
}
```
Note that the `loader` function is removed from client bundles so you can use server only APIs without worrying about them being included in the browser.
## Static Data Loading
When pre-rendering, loaders are used to fetch data during the production build.
```tsx filename=app/product.tsx
// route("products/:pid", "./product.tsx");
export async function loader({ params }: Route.LoaderArgs) {
  let product = await getProductFromCSVFile(params.pid);
  return product;
}
export default function Product({
  loaderData,
}: Route.ComponentProps) {
  const { name, description } = loaderData;
  return (
    <div>
      <h1>{name}</h1>
      <p>{description}</p>
    </div>
  );
}
```
The URLs to pre-render are specified in `react-router.config.ts`:
```ts filename=react-router.config.ts
export default {
  async prerender() {
    let products = await readProductsFromCSVFile();
    return products.map(
      (product) => `/products/${product.id}`,
    );
  },
} satisfies Config;
```
Note that when server rendering, any URLs that aren't pre-rendered will be server rendered as usual, allowing you to pre-render some data at a single route while still server rendering the rest.
## Using Both Loaders
`loader` and `clientLoader` can be used together. The `loader` will be used on the server for initial SSR (or pre-rendering) and the `clientLoader` will be used on subsequent client-side navigations.
```tsx filename=app/product.tsx
// route("products/:pid", "./product.tsx");
export async function loader({ params }: Route.LoaderArgs) {
  return fakeDb.getProduct(params.pid);
}
export async function clientLoader({
  serverLoader,
  params,
}: Route.ClientLoaderArgs) {
  const res = await fetch(`/api/products/${params.pid}`);
  const serverData = await serverLoader();
  return { ...serverData, ...res.json() };
}
export default function Product({
  loaderData,
}: Route.ComponentProps) {
  const { name, description } = loaderData;
  return (
    <div>
      <h1>{name}</h1>
      <p>{description}</p>
    </div>
  );
}
```
You can also force the client loader to run during hydration and before the page renders by setting the `hydrate` property on the function. In this situation you will want to render a `HydrateFallback` component to show a fallback UI while the client loader runs.
```tsx filename=app/product.tsx
export async function loader() {
  /* ... */
}
export async function clientLoader() {
  /* ... */
}
// force the client loader to run during hydration
clientLoader.hydrate = true as const; // `as const` for type inference
export function HydrateFallback() {
  return <div>Loading...</div>;
}
export default function Product() {
  /* ... */
}
```
---
Next: [Actions][actions]
See also:
- [Streaming with Suspense][streaming]
- [Client Data][client-data]
- [Using Fetchers][fetchers]
[type-safety]: ../../explanation/type-safety
[serializable-types]: https://react.dev/reference/rsc/use-client#serializable-types
[rsc]: ../../how-to/react-server-components
[actions]: ./actions
[streaming]: ../../how-to/suspense
[client-data]: ../../how-to/client-data
[fetchers]: ../../how-to/fetchers#loading-data

---

## Page 186 — `docs/start/framework/deploying.md`

Live URL: https://reactrouter.com/start/framework/deploying

# Deploying
[MODES: framework]
## Introduction
React Router can be deployed two ways:
- Fullstack Hosting
- Static Hosting
The official [React Router templates](https://github.com/remix-run/react-router-templates) can help you bootstrap an application or be used as a reference for your own application.
When deploying to static hosting, you can deploy React Router the same as any other single page application with React.
## Templates
After running the `create-react-router` command, make sure to follow the instructions in the README.
### Node.js with Docker
```
npx create-react-router@latest --template remix-run/react-router-templates/default
```
- Server Rendering
- Tailwind CSS
The containerized application can be deployed to any platform that supports Docker, including:
- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway
### Node with Docker (Custom Server)
```
npx create-react-router@latest --template remix-run/react-router-templates/node-custom-server
```
- Server Rendering
- Tailwind CSS
- Custom express server for more control
The containerized application can be deployed to any platform that supports Docker, including:
- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway
### Node with Docker and Postgres
```
npx create-react-router@latest --template remix-run/react-router-templates/node-postgres
```
- Server Rendering
- Postgres Database with Drizzle
- Tailwind CSS
- Custom express server for more control
The containerized application can be deployed to any platform that supports Docker, including:
- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway
### Vercel
Vercel maintains their own template for React Router. Checkout the [Vercel Guide](https://vercel.com/templates/react-router/react-router-boilerplate) for more information.
### Cloudflare Workers
Cloudflare maintains their own template for React Router. Checkout the [Cloudflare Guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/) for more information.
### Netlify
Netlify maintains their own template for React Router. Checkout the [Netlify Guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/react-router/) for more information.
### EdgeOne Pages
EdgeOne Pages maintains their own template for React Router. Checkout the [EdgeOne Pages Guide](https://pages.edgeone.ai/document/framework-react-router) for more information.

---

## Page 187 — `docs/start/framework/index.md`

Live URL: https://reactrouter.com/start/framework/index



---

## Page 188 — `docs/start/framework/installation.md`

Live URL: https://reactrouter.com/start/framework/installation

# Installation
[MODES: framework]
## Introduction
Most projects start with a template. Let's use a basic template maintained by React Router:
```shellscript nonumber
npx create-react-router@latest my-react-router-app
```
Now change into the new directory and start the app
```shellscript nonumber
cd my-react-router-app
npm i
npm run dev
```
You can now open your browser to `http://localhost:5173`
You can [view the template on GitHub][default-template] to see how to manually set up your project.
We also have a number of [ready to deploy templates][react-router-templates] available for you to get started with:
```shellscript nonumber
npx create-react-router@latest --template remix-run/react-router-templates/<template-name>
```
---
Next: [Routing](./routing)
[manual_usage]: ../how-to/manual-usage
[default-template]: https://github.com/remix-run/react-router-templates/tree/main/default
[react-router-templates]: https://github.com/remix-run/react-router-templates

---

## Page 189 — `docs/start/framework/navigating.md`

Live URL: https://reactrouter.com/start/framework/navigating

# Navigating
[MODES: framework]
## Introduction
Users navigate your application with `<Link>`, `<NavLink>`, `<Form>`, `redirect`, and `useNavigate`.
## NavLink
This component is for navigation links that need to render active and pending states.
```tsx
export function MyAppNav() {
  return (
    <nav>
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/trending" end>
        Trending Concerts
      </NavLink>
      <NavLink to="/concerts">All Concerts</NavLink>
      <NavLink to="/account">Account</NavLink>
    </nav>
  );
}
```
`NavLink` renders default class names for different states for easy styling with CSS:
```css
a.active {
  color: red;
}
a.pending {
  animate: pulse 1s infinite;
}
a.transitioning {
  /* css transition is running */
}
```
It also has callback props on `className`, `style`, and `children` with the states for inline styling or conditional rendering:
```tsx
// className
<NavLink
  to="/messages"
  className={({ isActive, isPending, isTransitioning }) =>
    [
      isPending ? "pending" : "",
      isActive ? "active" : "",
      isTransitioning ? "transitioning" : "",
    ].join(" ")
  }
>
  Messages
</NavLink>
```
```tsx
// style
<NavLink
  to="/messages"
  style={({ isActive, isPending, isTransitioning }) => {
    return {
      fontWeight: isActive ? "bold" : "",
      color: isPending ? "red" : "black",
      viewTransitionName: isTransitioning ? "slide" : "",
    };
  }}
>
  Messages
</NavLink>
```
```tsx
// children
<NavLink to="/tasks">
  {({ isActive, isPending, isTransitioning }) => (
    <span className={isActive ? "active" : ""}>Tasks</span>
  )}
</NavLink>
```
## Link
Use `<Link>` when the link doesn't need active styling:
```tsx
export function LoggedOutMessage() {
  return (
    <p>
      You've been logged out.{" "}
      <Link to="/login">Login again</Link>
    </p>
  );
}
```
## Form
The form component can be used to navigate with `URLSearchParams` provided by the user.
```tsx
<Form action="/search">
  <input type="text" name="q" />
</Form>
```
If the user enters "journey" into the input and submits it, they will navigate to:
```
/search?q=journey
```
Forms with `<Form method="post" />` will also navigate to the action prop but will submit the data as `FormData` instead of `URLSearchParams`. However, it is more common to `useFetcher()` to POST form data. See [Using Fetchers](../../how-to/fetchers).
## redirect
Inside of route loaders and actions, you can return a `redirect` to another URL.
```tsx
export async function loader({ request }) {
  let user = await getUser(request);
  if (!user) {
    return redirect("/login");
  }
  return { userName: user.name };
}
```
It is common to redirect to a new record after it has been created:
```tsx
export async function action({ request }) {
  let formData = await request.formData();
  let project = await createProject(formData);
  return redirect(`/projects/${project.id}`);
}
```
## useNavigate
This hook allows the programmer to navigate the user to a new page without the user interacting. Usage of this hook should be uncommon. It's recommended to use the other APIs in this guide when possible.
Reserve usage of `useNavigate` to situations where the user is _not_ interacting but you need to navigate, for example:
- Logging them out after inactivity
- Timed UIs like quizzes, etc.
```tsx
export function useLogoutAfterInactivity() {
  let navigate = useNavigate();
  useFakeInactivityHook(() => {
    navigate("/logout");
  });
}
```
---
Next: [Pending UI](./pending-ui)

---

## Page 190 — `docs/start/framework/pending-ui.md`

Live URL: https://reactrouter.com/start/framework/pending-ui

# Pending UI
[MODES: framework]
## Introduction
When the user navigates to a new route, or submits data to an action, the UI should immediately respond to the user's actions with a pending or optimistic state. Application code is responsible for this.
## Global Pending Navigation
When the user navigates to a new url, the loaders for the next page are awaited before the next page renders. You can get the pending state from `useNavigation`.
```tsx
export default function Root() {
  const navigation = useNavigation();
  const isNavigating = Boolean(navigation.location);
  return (
    <html>
      <body>
        {isNavigating && <GlobalSpinner />}
        <Outlet />
      </body>
    </html>
  );
}
```
## Local Pending Navigation
Pending indicators can also be localized to the link. NavLink's children, className, and style props can be functions that receive the pending state.
```tsx
function Navbar() {
  return (
    <nav>
      <NavLink to="/home">
        {({ isPending }) => (
          <span>Home {isPending && <Spinner />}</span>
        )}
      </NavLink>
      <NavLink
        to="/about"
        style={({ isPending }) => ({
          color: isPending ? "gray" : "black",
        })}
      >
        About
      </NavLink>
    </nav>
  );
}
```
## Pending Form Submission
When a form is submitted, the UI should immediately respond to the user's actions with a pending state. This is easiest to do with a [fetcher][use_fetcher] form because it has its own independent state (whereas normal forms cause a global navigation).
```tsx filename=app/project.tsx lines=[10-12]
function NewProjectForm() {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post">
      <input type="text" name="title" />
      <button type="submit">
        {fetcher.state !== "idle"
          ? "Submitting..."
          : "Submit"}
      </button>
    </fetcher.Form>
  );
}
```
For non-fetcher form submissions, pending states are available on `useNavigation`.
```tsx filename=app/projects/new.tsx
function NewProjectForm() {
  const navigation = useNavigation();
  return (
    <Form method="post" action="/projects/new">
      <input type="text" name="title" />
      <button type="submit">
        {navigation.formAction === "/projects/new"
          ? "Submitting..."
          : "Submit"}
      </button>
    </Form>
  );
}
```
## Optimistic UI
When the future state of the UI is known by the form submission data, an optimistic UI can be implemented for instant UX.
```tsx filename=app/project.tsx lines=[4-7]
function Task({ task }) {
  const fetcher = useFetcher();
  let isComplete = task.status === "complete";
  if (fetcher.formData) {
    isComplete =
      fetcher.formData.get("status") === "complete";
  }
  return (
    <div>
      <div>{task.title}</div>
      <fetcher.Form method="post">
        <button
          name="status"
          value={isComplete ? "incomplete" : "complete"}
        >
          {isComplete ? "Mark Incomplete" : "Mark Complete"}
        </button>
      </fetcher.Form>
    </div>
  );
}
```
---
Next: [Testing](./testing)
[use_fetcher]: https://api.reactrouter.com/v7/functions/react-router.useFetcher.html

---

## Page 191 — `docs/start/framework/rendering.md`

Live URL: https://reactrouter.com/start/framework/rendering

# Rendering Strategies
[MODES: framework]
## Introduction
There are three rendering strategies in React Router:
- Client Side Rendering
- Server Side Rendering
- Static Pre-rendering
## Client Side Rendering
Routes are always client side rendered as the user navigates around the app. If you're looking to build a Single Page App, disable server rendering:
```ts filename=react-router.config.ts
export default {
  ssr: false,
} satisfies Config;
```
## Server Side Rendering
```ts filename=react-router.config.ts
export default {
  ssr: true,
} satisfies Config;
```
Server side rendering requires a deployment that supports it. Though it's a global setting, individual routes can still be statically pre-rendered. Routes can also use client data loading with `clientLoader` to avoid server rendering/fetching for their portion of the UI.
## Static Pre-rendering
```ts filename=react-router.config.ts
export default {
  // return a list of URLs to prerender at build time
  async prerender() {
    return ["/", "/about", "/contact"];
  },
} satisfies Config;
```
Pre-rendering is a build-time operation that generates static HTML and client navigation data payloads for a list of URLs. This is useful for SEO and performance, especially for deployments without server rendering. When pre-rendering, route module loaders are used to fetch data at build time.
---
Next: [Data Loading](./data-loading)

---

## Page 192 — `docs/start/framework/route-module.md`

Live URL: https://reactrouter.com/start/framework/route-module

# Route Module
[MODES: framework]
## Introduction
The files referenced in `routes.ts` are called Route Modules.
```tsx filename=app/routes.ts
route("teams/:teamId", "./team.tsx"),
//           route module ^^^^^^^^
```
Route modules are the foundation of React Router's framework features, they define:
- automatic code-splitting
- data loading
- actions
- revalidation
- error boundaries
- and more
This guide is a quick overview of every route module feature. The rest of the getting started guides will cover these features in more detail.
## Component (`default`)
The `default` export in a route module defines the component that will render when the route matches.
```tsx filename=app/routes/my-route.tsx
export default function MyRouteComponent() {
  return (
    <div>
      <h1>Look ma!</h1>
      <p>
        I'm still using React Router after like 10 years.
      </p>
    </div>
  );
}
```
### Props passed to the Component
When the component is rendered, it is provided the props defined in `Route.ComponentProps` that React Router will automatically generate for you. These props include:
1. `loaderData`: The data returned from the `loader` function in this route module
2. `actionData`: The data returned from the `action` function in this route module
3. `params`: An object containing the route parameters (if any).
4. `matches`: An array of all the matches in the current route tree.
You can use these props in place of hooks like `useLoaderData` or `useParams`. This may be preferable because they will be automatically typed correctly for the route.
### Using props
```tsx filename=app/routes/my-route-with-default-params.tsx
export default function MyRouteComponent({
  loaderData,
  actionData,
  params,
  matches,
}: Route.ComponentProps) {
  return (
    <div>
      <h1>Welcome to My Route with Props!</h1>
      <p>Loader Data: {JSON.stringify(loaderData)}</p>
      <p>Action Data: {JSON.stringify(actionData)}</p>
      <p>Route Parameters: {JSON.stringify(params)}</p>
      <p>Matched Routes: {JSON.stringify(matches)}</p>
    </div>
  );
}
```
## `middleware`
Route [middleware][middleware] runs sequentially on the server before and after document and
data requests. This gives you a singular place to do things like logging,
authentication, and post-processing of responses. The `next` function continues down the chain, and on the leaf route the `next` function executes the loaders/actions for the navigation.
Here's an example middleware to log requests on the server:
```tsx filename=root.tsx
async function loggingMiddleware(
  { request, context },
  next,
) {
  console.log(
    `${new Date().toISOString()} ${request.method} ${request.url}`,
  );
  const start = performance.now();
  const response = await next();
  const duration = performance.now() - start;
  console.log(
    `${new Date().toISOString()} Response ${response.status} (${duration}ms)`,
  );
  return response;
}
```
Here's an example middleware to check for logged in users and set the user in
`context` you can then access from loaders:
```tsx filename=routes/_auth.tsx
async function authMiddleware({ request, context }) {
  const session = await getSession(request);
  const userId = session.get("userId");
  if (!userId) {
    throw redirect("/login");
  }
  const user = await getUserById(userId);
  context.set(userContext, user);
}
```
<docs-warning>Please make sure you understand [when middleware runs][when-middleware-runs] to make sure your application will behave the way you intend when adding middleware to your routes.</docs-warning>
See also:
- [`middleware` params][middleware-params]
- [Middleware][middleware]
## `clientMiddleware`
This is the client-side equivalent of `middleware` and runs in the browser during client navigations. The only difference from server middleware is that client middleware doesn't return Responses because they're not wrapping an HTTP request on the server.
Here's an example middleware to log requests on the client:
```tsx filename=root.tsx
async function loggingMiddleware(
  { request, context },
  next,
) {
  console.log(
    `${new Date().toISOString()} ${request.method} ${request.url}`,
  );
  const start = performance.now();
  await next(); // 👈 No Response returned
  const duration = performance.now() - start;
  console.log(
    `${new Date().toISOString()} (${duration}ms)`,
  );
  // ✅ No need to return anything
}
```
See also:
- [Middleware][middleware]
- [Client Data][client-data]
## `loader`
Route loaders provide data to route components before they are rendered. They are only called on the server when server rendering or during the build with pre-rendering.
```tsx
export async function loader() {
  return { message: "Hello, world!" };
}
export default function MyRoute({ loaderData }) {
  return <h1>{loaderData.message}</h1>;
}
```
See also:
- [`loader` params][loader-params]
## `clientLoader`
Called only in the browser, route client loaders provide data to route components in addition to, or in place of, route loaders.
```tsx
export async function clientLoader({ serverLoader }) {
  // call the server loader
  const serverData = await serverLoader();
  // And/or fetch data on the client
  const data = getDataFromClient();
  // Return the data to expose through useLoaderData()
  return data;
}
```
Client loaders can participate in initial page load hydration of server rendered pages by setting the `hydrate` property on the function:
```tsx
export async function clientLoader() {
  // ...
}
clientLoader.hydrate = true as const;
```
<docs-info>
By using `as const`, TypeScript will infer that the type for `clientLoader.hydrate` is `true` instead of `boolean`.
That way, React Router can derive types for `loaderData` based on the value of `clientLoader.hydrate`.
</docs-info>
See also:
- [`clientLoader` params][client-loader-params]
- [Client Data][client-data]
## `action`
Route actions allow server-side data mutations with automatic revalidation of all loader data on the page when called from `<Form>`, `useFetcher`, and `useSubmit`.
```tsx
// route("/list", "./list.tsx")
// this data will be loaded after the action completes...
export async function loader() {
  const items = await fakeDb.getItems();
  return { items };
}
// ...so that the list here is updated automatically
export default function Items({ loaderData }) {
  return (
    <div>
      <List items={loaderData.items} />
      <Form method="post" navigate={false} action="/list">
        <input type="text" name="title" />
        <button type="submit">Create Todo</button>
      </Form>
    </div>
  );
}
export async function action({ request }) {
  const data = await request.formData();
  const todo = await fakeDb.addItem({
    title: data.get("title"),
  });
  return { ok: true };
}
```
See also:
- [`action` params][action-params]
## `clientAction`
Like route actions but only called in the browser.
```tsx
export async function clientAction({ serverAction }) {
  fakeInvalidateClientSideCache();
  // can still call the server action if needed
  const data = await serverAction();
  return data;
}
```
See also:
- [`clientAction` params][client-action-params]
- [Client Data][client-data]
## `ErrorBoundary`
When other route module APIs throw, the route module `ErrorBoundary` will render instead of the route component.
```tsx
export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <h1>
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </div>
    );
  } else if (error instanceof Error) {
    return (
      <div>
        <h1>Error</h1>
        <p>{error.message}</p>
        <p>The stack trace is:</p>
        <pre>{error.stack}</pre>
      </div>
    );
  } else {
    return <h1>Unknown Error</h1>;
  }
}
```
See also:
- [`useRouteError`][use-route-error]
- [`isRouteErrorResponse`][is-route-error-response]
## `HydrateFallback`
On initial page load, the route component renders only after the client loader is finished. If exported, a `HydrateFallback` can render immediately in place of the route component.
```tsx filename=routes/client-only-route.tsx
export async function clientLoader() {
  const data = await fakeLoadLocalGameData();
  return data;
}
export function HydrateFallback() {
  return <p>Loading Game...</p>;
}
export default function Component({ loaderData }) {
  return <Game data={loaderData} />;
}
```
## `headers`
The route `headers` function defines the HTTP headers to be sent with the response when server rendering.
```tsx
export function headers() {
  return {
    "X-Stretchy-Pants": "its for fun",
    "Cache-Control": "max-age=300, s-maxage=3600",
  };
}
```
See also:
- [`Headers`][headers]
## `handle`
Route handle allows apps to add anything to a route match in `useMatches` to create abstractions (like breadcrumbs, etc.).
```tsx
```
See also:
- [`useMatches`][use-matches]
## `links`
Route links define [`<link>` element][link-element]s to be rendered in the document `<head>`.
```tsx
export function links() {
  return [
    {
      rel: "icon",
      href: "/favicon.png",
      type: "image/png",
    },
    {
      rel: "stylesheet",
      href: "https://example.com/some/styles.css",
    },
    {
      rel: "preload",
      href: "/images/banner.jpg",
      as: "image",
    },
  ];
}
```
All routes links will be aggregated and rendered through the `<Links />` component, usually rendered in your app root:
```tsx
export default function Root() {
  return (
    <html>
      <head>
        <Links />
      </head>
      <body />
    </html>
  );
}
```
See also:
- [Styling][styling]
## `meta`
Route meta defines [meta tags][meta-element] to be rendered in the `<Meta />` component, usually placed in the `<head>`.
<docs-warning>
Since React 19, [using the built-in `<meta>` element](https://react.dev/reference/react-dom/components/meta) is recommended over the use of the route module's `meta` export.
Here is an example of how to use it and the `<title>` element:
```tsx
export default function MyRoute() {
  return (
    <div>
      <title>Very cool app</title>
      <meta property="og:title" content="Very cool app" />
      <meta
        name="description"
        content="This app is the best"
      />
      {/* The rest of your route content... */}
    </div>
  );
}
```
</docs-warning>
```tsx filename=app/product.tsx
export function meta() {
  return [
    { title: "Very cool app" },
    {
      property: "og:title",
      content: "Very cool app",
    },
    {
      name: "description",
      content: "This app is the best",
    },
  ];
}
```
```tsx filename=app/root.tsx
export default function Root() {
  return (
    <html>
      <head>
        <Meta />
      </head>
      <body />
    </html>
  );
}
```
The meta of the last matching route is used, allowing you to override parent routes' meta. It's important to note that the entire meta descriptor array is replaced, not merged. This gives you the flexibility to build your own meta composition logic across pages at different levels.
**See also**
- [`meta` params][meta-params]
- [`meta` function return types][meta-function]
## `shouldRevalidate`
In framework mode with SSR, route loaders are automatically revalidated after all navigations and form submissions (this is different from [Data Mode][data-mode-should-revalidate]). This enables middleware and loaders to share a request context and optimize in different ways than they would in Data Mode.
Defining this function allows you to opt out of revalidation for a route loader for navigations and form submissions.
```tsx
export function shouldRevalidate(
  arg: ShouldRevalidateFunctionArgs,
) {
  return true;
}
```
When using [SPA Mode][spa-mode], there are no server loaders to call on navigations, so `shouldRevalidate` behaves the same as it does in [Data Mode][data-mode-should-revalidate].
[`ShouldRevalidateFunctionArgs` Reference Documentation ↗](https://api.reactrouter.com/v7/interfaces/react-router.ShouldRevalidateFunctionArgs.html)
---
Next: [Rendering Strategies](./rendering)
[middleware-params]: https://api.reactrouter.com/v7/types/react-router.MiddlewareFunction.html
[middleware]: ../../how-to/middleware
[when-middleware-runs]: ../../how-to/middleware#when-middleware-runs
[loader-params]: https://api.reactrouter.com/v7/interfaces/react-router.LoaderFunctionArgs
[client-loader-params]: https://api.reactrouter.com/v7/types/react-router.ClientLoaderFunctionArgs
[action-params]: https://api.reactrouter.com/v7/interfaces/react-router.ActionFunctionArgs
[client-action-params]: https://api.reactrouter.com/v7/types/react-router.ClientActionFunctionArgs
[use-route-error]: ../../api/hooks/useRouteError
[is-route-error-response]: ../../api/utils/isRouteErrorResponse
[headers]: https://developer.mozilla.org/en-US/docs/Web/API/Response/headers
[use-matches]: ../../api/hooks/useMatches
[link-element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link
[meta-element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta
[meta-params]: https://api.reactrouter.com/v7/interfaces/react-router.MetaArgs
[meta-function]: https://api.reactrouter.com/v7/types/react-router.MetaDescriptor.html
[data-mode-should-revalidate]: ../data/route-object#shouldrevalidate
[spa-mode]: ../../how-to/spa
[client-data]: ../../how-to/client-data
[styling]: ../../explanation/styling

---

## Page 193 — `docs/start/framework/routing.md`

Live URL: https://reactrouter.com/start/framework/routing

# Routing
[MODES: framework]
## Configuring Routes
Routes are configured in `app/routes.ts`. Each route has two required parts: a URL pattern to match the URL, and a file path to the route module that defines its behavior.
```ts filename=app/routes.ts
export default [
  route("some/path", "./some/file.tsx"),
  // pattern ^           ^ module file
] satisfies RouteConfig;
```
Here is a larger sample route config:
```ts filename=app/routes.ts
export default [
  index("./home.tsx"),
  route("about", "./about.tsx"),
  layout("./auth/layout.tsx", [
    route("login", "./auth/login.tsx"),
    route("register", "./auth/register.tsx"),
  ]),
  ...prefix("concerts", [
    index("./concerts/home.tsx"),
    route(":city", "./concerts/city.tsx"),
    route("trending", "./concerts/trending.tsx"),
  ]),
] satisfies RouteConfig;
```
If you prefer to define your routes via file naming conventions rather than configuration, the `@react-router/fs-routes` package provides a [file system routing convention][file-route-conventions]. You can even combine different routing conventions if you like:
```ts filename=app/routes.ts
export default [
  route("/", "./home.tsx"),
  ...(await flatRoutes()),
] satisfies RouteConfig;
```
## Route Modules
The files referenced in `routes.ts` define each route's behavior:
```tsx filename=app/routes.ts
route("teams/:teamId", "./team.tsx"),
//           route module ^^^^^^^^
```
Here's a sample route module:
```tsx filename=app/team.tsx
// provides type safety/inference
// provides `loaderData` to the component
export async function loader({ params }: Route.LoaderArgs) {
  let team = await fetchTeam(params.teamId);
  return { name: team.name };
}
// renders after the loader is done
export default function Component({
  loaderData,
}: Route.ComponentProps) {
  return <h1>{loaderData.name}</h1>;
}
```
Route modules have more features like actions, headers, and error boundaries, but they will be covered in the next guide: [Route Modules](./route-module)
## Nested Routes
Routes can be nested inside parent routes.
```ts filename=app/routes.ts
export default [
  // parent route
  route("dashboard", "./dashboard.tsx", [
    // child routes
    index("./home.tsx"),
    route("settings", "./settings.tsx"),
  ]),
] satisfies RouteConfig;
```
The path of the parent is automatically included in the child, so this config creates both `"/dashboard"` and `"/dashboard/settings"` URLs.
Child routes are rendered through the `<Outlet/>` in the parent route.
```tsx filename=app/dashboard.tsx
export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      {/* will either be home.tsx or settings.tsx */}
      <Outlet />
    </div>
  );
}
```
## Root Route
Every route in `routes.ts` is nested inside the special `app/root.tsx` module.
## Layout Routes
Using `layout`, layout routes create new nesting for their children, but they don't add any segments to the URL. It's like the root route but they can be added at any level.
```tsx filename=app/routes.ts lines=[10,16]
export default [
  layout("./marketing/layout.tsx", [
    index("./marketing/home.tsx"),
    route("contact", "./marketing/contact.tsx"),
  ]),
  ...prefix("projects", [
    index("./projects/home.tsx"),
    layout("./projects/project-layout.tsx", [
      route(":pid", "./projects/project.tsx"),
      route(":pid/edit", "./projects/edit-project.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
```
Note that:
- `home.tsx` and `contact.tsx` will be rendered into the `marketing/layout.tsx` outlet without creating any new URL paths
- `project.tsx` and `edit-project.tsx` will be rendered into the `projects/project-layout.tsx` outlet at `/projects/:pid` and `/projects/:pid/edit` while `projects/home.tsx` will not.
## Index Routes
```ts
index(componentFile),
```
Index routes render into their parent's [Outlet][outlet] at their parent's URL (like a default child route).
```ts filename=app/routes.ts
export default [
  // renders into the root.tsx Outlet at /
  index("./home.tsx"),
  route("dashboard", "./dashboard.tsx", [
    // renders into the dashboard.tsx Outlet at /dashboard
    index("./dashboard-home.tsx"),
    route("settings", "./dashboard-settings.tsx"),
  ]),
] satisfies RouteConfig;
```
Note that index routes can't have children.
## Route Prefixes
Using `prefix`, you can add a path prefix to a set of routes without needing to introduce a parent route.
```tsx filename=app/routes.ts lines=[14]
export default [
  layout("./marketing/layout.tsx", [
    index("./marketing/home.tsx"),
    route("contact", "./marketing/contact.tsx"),
  ]),
  ...prefix("projects", [
    index("./projects/home.tsx"),
    layout("./projects/project-layout.tsx", [
      route(":pid", "./projects/project.tsx"),
      route(":pid/edit", "./projects/edit-project.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
```
Note that this does not introduce a new route into the route tree. Instead, it merely modifies the paths of its children.
For example, these two sets of routes are equivalent:
```ts filename=app/routes.ts
// This usage of `prefix`...
prefix("parent", [
  route("child1", "./child1.tsx"),
  route("child2", "./child2.tsx"),
])
// ...is equivalent to this:
[
  route("parent/child1", "./child1.tsx"),
  route("parent/child2", "./child2.tsx"),
]
```
## Dynamic Segments
If a path segment starts with `:` then it becomes a "dynamic segment". When the route matches the URL, the dynamic segment will be parsed from the URL and provided as `params` to other router APIs.
```ts filename=app/routes.ts
route("teams/:teamId", "./team.tsx"),
```
```tsx filename=app/team.tsx
export async function loader({ params }: Route.LoaderArgs) {
  //                           ^? { teamId: string }
}
export default function Component({
  params,
}: Route.ComponentProps) {
  params.teamId;
  //        ^ string
}
```
You can have multiple dynamic segments in one route path:
```ts filename=app/routes.ts
route("c/:categoryId/p/:productId", "./product.tsx"),
```
```tsx filename=app/product.tsx
async function loader({ params }: LoaderArgs) {
  //                    ^? { categoryId: string; productId: string }
}
```
## Optional Segments
You can make a route segment optional by adding a `?` to the end of the segment.
```ts filename=app/routes.ts
route(":lang?/categories", "./categories.tsx"),
```
You can have optional static segments, too:
```ts filename=app/routes.ts
route("users/:userId/edit?", "./user.tsx");
```
## Splats
Also known as "catchall" and "star" segments. If a route path pattern ends with `/*` then it will match any characters following the `/`, including other `/` characters.
```ts filename=app/routes.ts
route("files/*", "./files.tsx"),
```
```tsx filename=app/files.tsx
export async function loader({ params }: Route.LoaderArgs) {
  // params["*"] will contain the remaining URL after files/
}
```
You can destructure the `*`, you just have to assign it a new name. A common name is `splat`:
```tsx
const { "*": splat } = params;
```
You can also use a splat to catch requests that don't match any route:
```ts filename=app/routes.ts
route("*", "./catchall.tsx"); // catchall route,
```
```tsx filename=app/catchall.tsx
export function loader() {
  throw new Response("Page not found", { status: 404 });
}
```
## Component Routes
You can also use components that match the URL to elements anywhere in the component tree:
```tsx
function Wizard() {
  return (
    <div>
      <h1>Some Wizard with Steps</h1>
      <Routes>
        <Route index element={<StepOne />} />
        <Route path="step-2" element={<StepTwo />} />
        <Route path="step-3" element={<StepThree />} />
      </Routes>
    </div>
  );
}
```
Note that these routes do not participate in data loading, actions, code splitting, or any other route module features, so their use cases are more limited than those of the route module.
---
Next: [Route Module](./route-module)
[file-route-conventions]: ../../how-to/file-route-conventions
[outlet]: https://api.reactrouter.com/v7/functions/react-router.Outlet.html

---

## Page 194 — `docs/start/framework/testing.md`

Live URL: https://reactrouter.com/start/framework/testing

# Testing
[MODES: framework, data]
## Introduction
When components use things like `useLoaderData`, `<Link>`, etc, they are required to be rendered in context of a React Router app. The `createRoutesStub` function creates that context to test components in isolation.
Consider a login form component that relies on `useActionData`
```tsx
export function LoginForm() {
  const actionData = useActionData();
  const errors = actionData?.errors;
  return (
    <Form method="post">
      <label>
        <input type="text" name="username" />
        {errors?.username && <div>{errors.username}</div>}
      </label>
      <label>
        <input type="password" name="password" />
        {errors?.password && <div>{errors.password}</div>}
      </label>
      <button type="submit">Login</button>
    </Form>
  );
}
```
We can test this component with `createRoutesStub`. It takes an array of objects that resemble route modules with loaders, actions, and components.
```tsx
test("LoginForm renders error messages", async () => {
  const USER_MESSAGE = "Username is required";
  const PASSWORD_MESSAGE = "Password is required";
  const Stub = createRoutesStub([
    {
      path: "/login",
      Component: LoginForm,
      action() {
        return {
          errors: {
            username: USER_MESSAGE,
            password: PASSWORD_MESSAGE,
          },
        };
      },
    },
  ]);
  // render the app stub at "/login"
  render(<Stub initialEntries={["/login"]} />);
  // simulate interactions
  userEvent.click(screen.getByText("Login"));
  await waitFor(() => screen.findByText(USER_MESSAGE));
  await waitFor(() => screen.findByText(PASSWORD_MESSAGE));
});
```
## Using with Framework Mode Types
It's important to note that `createRoutesStub` is designed for _unit_ testing of reusable components in your application that rely on contextual router information (i.e., `loaderData`, `actionData`, `matches`). These components usually obtain this information via the hooks (`useLoaderData`, `useActionData`, `useMatches`) or via props passed down from the ancestor route component. We **strongly** recommend limiting your usage of `createRoutesStub` to unit testing of these types of reusable components.
`createRoutesStub` is _not designed_ for (and is arguably incompatible with) direct testing of Route components using the [`Route.\*`](../../explanation/type-safety) types available in Framework Mode. This is because the `Route.*` types are derived from your actual application - including the real `loader`/`action` functions as well as the structure of your route tree structure (which defines the `matches` type). When you use `createRoutesStub`, you are providing stubbed values for `loaderData`, `actionData`, and even your `matches` based on the route tree you pass to `createRoutesStub`. Therefore, the types won't align with the `Route.*` types and you'll get type issues trying to use a route component in a route stub.
```tsx filename=routes/login.tsx
export default function Login({
  actionData,
}: Route.ComponentProps) {
  return <Form method="post">...</Form>;
}
```
```tsx filename=routes/login.test.tsx
test("LoginRoute renders error messages", async () => {
  const Stub = createRoutesStub([
    {
      path: "/login",
      Component: LoginRoute,
      // ^ ❌ Types of property 'matches' are incompatible.
      action() {
        /*...*/
      },
    },
  ]);
  // ...
});
```
These type errors are generally accurate if you try to setup your tests like this. As long as your stubbed `loader`/`action` functions match your real implementations, then the types for `loaderData`/`actionData` will be correct, but if they differ your types will be lying to you.
`matches` is more complicated since you don't usually stub out all of the ancestor routes. In this example, there is no `root` route so `matches` will only contain your test route, while it will contain the root route and any other ancestors at runtime. There's no great way to automatically align the typegen types with the runtime types in your test.
Therefore, if you need to test Route level components, we recommend you do that via an Integration/E2E test (Playwright, Cypress, etc.) against a running application because you're venturing out of unit testing territory when testing your route as a whole.
If you _need_ to write a unit test against the route, you can add a `@ts-expect-error` comment in your test to silence the TypeScript error:
```tsx
const Stub = createRoutesStub([
  {
    path: "/login",
    // @ts-expect-error: `matches` won't align between test code and app code
    Component: LoginRoute,
    action() {
      /*...*/
    },
  },
]);
```

---

## Page 195 — `docs/start/index.md`

Live URL: https://reactrouter.com/start/index



---

## Page 196 — `docs/start/modes.md`

Live URL: https://reactrouter.com/start/modes

# Picking a Mode
React Router is a multi-strategy router for React. There are three primary ways, or "modes", to use it in your app. Across the docs you'll see these icons indicating which mode the content is relevant to:
[MODES: framework, data, declarative]
<p></p>
The features available in each mode are additive, so moving from Declarative to Data to Framework simply adds more features at the cost of architectural control. So pick your mode based on how much control or how much help you want from React Router.
The mode depends on which "top level" router API you're using:
## Declarative
Declarative mode enables basic routing features like matching URLs to components, navigating around the app, and providing active states with APIs like `<Link>`, `useNavigate`, and `useLocation`.
```tsx
ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
```
## Data
By moving route configuration outside of React rendering, Data Mode adds data loading, actions, pending states and more with APIs like `loader`, `action`, and `useFetcher`.
```tsx
let router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    loader: loadRootData,
  },
]);
ReactDOM.createRoot(root).render(
  <RouterProvider router={router} />,
);
```
## Framework
Framework Mode wraps Data Mode with a Vite plugin to add the full React Router experience with:
- type-safe `href`
- type-safe Route Module API
- intelligent code splitting
- SPA, SSR, and static rendering strategies
- and more
```ts filename=routes.ts
export default [
  index("./home.tsx"),
  route("products/:pid", "./product.tsx"),
];
```
You'll then have access to the Route Module API with type-safe params, loaderData, code splitting, SPA/SSR/SSG strategies, and more.
```ts filename=product.tsx
export async function loader({ params }: Route.LoaderArgs) {
  let product = await getProduct(params.pid);
  return { product };
}
export default function Product({
  loaderData,
}: Route.ComponentProps) {
  return <div>{loaderData.product.name}</div>;
}
```
## Decision Advice
Every mode supports any architecture and deployment target, so the question isn't really about if you want SSR, SPA, etc. It's about how much you want to do yourself.
**Use Framework Mode if you:**
- are too new to have an opinion
- are considering Next.js, Solid Start, SvelteKit, Astro, TanStack Start, etc. and want to compare
- just want to build something with React
- might want to server render, might not
- are coming from Remix (React Router v7 is the "next version" after Remix v2)
- are migrating from Next.js
[→ Get Started with Framework Mode](./framework/installation).
**Use Data Mode if you:**
- want data features but also want to have control over bundling, data, and server abstractions
- started a data router in v6.4 and are happy with it
[→ Get Started with Data Mode](./data/custom).
**Use Declarative Mode if you:**
- want to use React Router as simply as possible
- are coming from v6 and are happy with the `<BrowserRouter>`
- have a data layer that either skips pending states (like local first, background data replication/sync) or has its own abstractions for them
- are coming from Create React App (you may want to consider framework mode though)
[→ Get Started with Declarative Mode](./declarative/installation).
## API + Mode Availability Table
This is mostly for the LLMs, but knock yourself out:
| API                            | Framework | Data | Declarative |
| ------------------------------ | --------- | ---- | ----------- |
| Await                          | ✅        | ✅   |             |
| Form                           | ✅        | ✅   |
| Link                           | ✅        | ✅   | ✅          |
| `<Link discover>`              | ✅        |      |             |
| `<Link prefetch>`              | ✅        |      |             |
| `<Link preventScrollReset>`    | ✅        | ✅   |             |
| Links                          | ✅        |      |             |
| Meta                           | ✅        |      |             |
| NavLink                        | ✅        | ✅   | ✅          |
| `<NavLink discover>`           | ✅        |      |             |
| `<NavLink prefetch>`           | ✅        |      |             |
| `<NavLink preventScrollReset>` | ✅        | ✅   |             |
| NavLink `isPending`            | ✅        | ✅   |             |
| Navigate                       | ✅        | ✅   | ✅          |
| Outlet                         | ✅        | ✅   | ✅          |
| PrefetchPageLinks              | ✅        |      |             |
| Route                          | ✅        | ✅   | ✅          |
| Routes                         | ✅        | ✅   | ✅          |
| Scripts                        | ✅        |      |             |
| ScrollRestoration              | ✅        | ✅   |             |
| ServerRouter                   | ✅        |      |             |
| usePrompt                      | ✅        | ✅   |             |
| useActionData                  | ✅        | ✅   |             |
| useAsyncError                  | ✅        | ✅   |             |
| useAsyncValue                  | ✅        | ✅   |             |
| useBeforeUnload                | ✅        | ✅   | ✅          |
| useBlocker                     | ✅        | ✅   |             |
| useFetcher                     | ✅        | ✅   |             |
| useFetchers                    | ✅        | ✅   |             |
| useFormAction                  | ✅        | ✅   |             |
| useHref                        | ✅        | ✅   | ✅          |
| useInRouterContext             | ✅        | ✅   | ✅          |
| useLinkClickHandler            | ✅        | ✅   | ✅          |
| useLoaderData                  | ✅        | ✅   |             |
| useLocation                    | ✅        | ✅   | ✅          |
| useMatch                       | ✅        | ✅   | ✅          |
| useMatches                     | ✅        | ✅   |             |
| useNavigate                    | ✅        | ✅   | ✅          |
| useNavigation                  | ✅        | ✅   |             |
| useNavigationType              | ✅        | ✅   | ✅          |
| useOutlet                      | ✅        | ✅   | ✅          |
| useOutletContext               | ✅        | ✅   | ✅          |
| useParams                      | ✅        | ✅   | ✅          |
| useResolvedPath                | ✅        | ✅   | ✅          |
| useRevalidator                 | ✅        | ✅   |             |
| useRouteError                  | ✅        | ✅   |             |
| useRouteLoaderData             | ✅        | ✅   |             |
| useRoutes                      | ✅        | ✅   | ✅          |
| useSearchParams                | ✅        | ✅   | ✅          |
| useSubmit                      | ✅        | ✅   |             |
| useViewTransitionState         | ✅        | ✅   |             |
| isCookieFunction               | ✅        | ✅   |             |
| isSessionFunction              | ✅        | ✅   |             |
| createCookie                   | ✅        | ✅   |             |
| createCookieSessionStorage     | ✅        | ✅   |             |
| createMemorySessionStorage     | ✅        | ✅   |             |
| createPath                     | ✅        | ✅   | ✅          |
| createRoutesFromElements       |           | ✅   |             |
| createRoutesStub               | ✅        | ✅   |             |
| createSearchParams             | ✅        | ✅   | ✅          |
| data                           | ✅        | ✅   |             |
| generatePath                   | ✅        | ✅   | ✅          |
| href                           | ✅        |      |             |
| isCookie                       | ✅        | ✅   |             |
| isRouteErrorResponse           | ✅        | ✅   |             |
| isSession                      | ✅        | ✅   |             |
| matchPath                      | ✅        | ✅   | ✅          |
| matchRoutes                    | ✅        | ✅   | ✅          |
| parsePath                      | ✅        | ✅   | ✅          |
| redirect                       | ✅        | ✅   |             |
| redirectDocument               | ✅        | ✅   |             |
| renderMatches                  | ✅        | ✅   | ✅          |
| replace                        | ✅        | ✅   |             |
| resolvePath                    | ✅        | ✅   | ✅          |

---

## Page 197 — `docs/tutorials/address-book.md`

Live URL: https://reactrouter.com/tutorials/address-book

# Address Book
[MODES: framework]
<br />
<br />
We'll be building a small, but feature-rich address book app that lets you keep track of your contacts. There's no database or other "production ready" things, so we can stay focused on the features React Router gives you. We expect it to take 30-45m if you're following along, otherwise it's a quick read.
<docs-info>
You can also watch our [walkthrough of the React Router Tutorial](https://www.youtube.com/watch?v=pw8FAg07kdo) if you prefer 🎥
</docs-info>
<img class="tutorial" src="/_docs/v7_address_book_tutorial/01.webp" />
👉 **Every time you see this it means you need to do something in the app!**
The rest is just there for your information and deeper understanding. Let's get to it.
## Setup
👉 **Generate a basic template**
```shellscript nonumber
npx create-react-router@latest --template remix-run/react-router/tutorials/address-book
```
This uses a pretty bare-bones template but includes our css and data model, so we can focus on React Router.
👉 **Start the app**
```shellscript nonumber
# cd into the app directory
cd {wherever you put the app}
# install dependencies if you haven't already
npm install
# start the server
npm run dev
```
You should now be able to open up [http://localhost:5173][http-localhost-5173] and see your app running, though there's not much going on just yet.
## The Root Route
Note the file at `app/root.tsx`. This is what we call the ["Root Route"][root-route]. It's the first component in the UI that renders, so it typically contains the global layout for the page, as well as a the default [Error Boundary][error-boundaries].
<details>
<summary>Expand here to see the root component code</summary>
```tsx filename=app/root.tsx
export default function App() {
  return (
    <>
      <div id="sidebar">
        <h1>React Router Contacts</h1>
        <div>
          <Form id="search-form" role="search">
            <input
              aria-label="Search contacts"
              id="q"
              name="q"
              placeholder="Search"
              type="search"
            />
            <div
              aria-hidden
              hidden={true}
              id="search-spinner"
            />
          </Form>
          <Form method="post">
            <button type="submit">New</button>
          </Form>
        </div>
        <nav>
          <ul>
            <li>
              <a href={`/contacts/1`}>Your Name</a>
            </li>
            <li>
              <a href={`/contacts/2`}>Your Friend</a>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
// The Layout component is a special export for the root route.
// It acts as your document's "app shell" for all route components, HydrateFallback, and ErrorBoundary
// For more information, see https://reactrouter.com/explanation/special-files#layout-export
export function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <link rel="stylesheet" href={appStylesHref} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
// The top most error boundary for the app, rendered when your app throws an error
// For more information, see https://reactrouter.com/start/framework/route-module#errorboundary
export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (
    import.meta.env.DEV &&
    error &&
    error instanceof Error
  ) {
    details = error.message;
    stack = error.stack;
  }
  return (
    <main id="error-page">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
```
</details>
## The Contact Route UI
If you click on one of the sidebar items you'll get the default 404 page. Let's create a route that matches the url `/contacts/1`.
👉 **Create a contact route module**
```shellscript nonumber
mkdir app/routes
touch app/routes/contact.tsx
```
We could put this file anywhere we want, but to make things a bit more organized, we'll put all our routes inside the `app/routes` directory.
You can also use [file-based routing if you prefer][file-route-conventions].
👉 **Configure the route**
We need to tell React Router about our new route. `routes.ts` is a special file where we can configure all our routes.
```tsx filename=routes.ts lines=[2,5]
export default [
  route("contacts/:contactId", "routes/contact.tsx"),
] satisfies RouteConfig;
```
In React Router, `:` makes a segment dynamic. We just made the following urls match the `routes/contact.tsx` route module:
- `/contacts/123`
- `/contacts/abc`
👉 **Add the contact component UI**
It's just a bunch of elements, feel free to copy/paste.
```tsx filename=app/routes/contact.tsx
export default function Contact() {
  const contact = {
    first: "Your",
    last: "Name",
    avatar: "https://placecats.com/200/200",
    twitter: "your_handle",
    notes: "Some notes",
    favorite: true,
  };
  return (
    <div id="contact">
      <div>
        <img
          alt={`${contact.first} ${contact.last} avatar`}
          key={contact.avatar}
          src={contact.avatar}
        />
      </div>
      <div>
        <h1>
          {contact.first || contact.last ? (
            <>
              {contact.first} {contact.last}
            </>
          ) : (
            <i>No Name</i>
          )}
          <Favorite contact={contact} />
        </h1>
        {contact.twitter ? (
          <p>
            <a
              href={`https://twitter.com/${contact.twitter}`}
            >
              {contact.twitter}
            </a>
          </p>
        ) : null}
        {contact.notes ? <p>{contact.notes}</p> : null}
        <div>
          <Form action="edit">
            <button type="submit">Edit</button>
          </Form>
          <Form
            action="destroy"
            method="post"
            onSubmit={(event) => {
              const response = confirm(
                "Please confirm you want to delete this record.",
              );
              if (!response) {
                event.preventDefault();
              }
            }}
          >
            <button type="submit">Delete</button>
          </Form>
        </div>
      </div>
    </div>
  );
}
function Favorite({
  contact,
}: {
  contact: Pick<ContactRecord, "favorite">;
}) {
  const favorite = contact.favorite;
  return (
    <Form method="post">
      <button
        aria-label={
          favorite
            ? "Remove from favorites"
            : "Add to favorites"
        }
        name="favorite"
        value={favorite ? "false" : "true"}
      >
        {favorite ? "★" : "☆"}
      </button>
    </Form>
  );
}
```
Now if we click one of the links or visit [`/contacts/1`][contacts-1] we get ... nothing new?
<img class="tutorial" src="/_docs/v7_address_book_tutorial/02.webp" />
## Nested Routes and Outlets
React Router supports nested routing. In order for child routes to render inside of parent layouts, we need to render an [`Outlet`][outlet-component] in the parent. Let's fix it, open up `app/root.tsx` and render an outlet inside.
👉 **Render an [`<Outlet />`][outlet-component]**
```tsx filename=app/root.tsx lines=[3,15-17]
// existing imports & exports
export default function App() {
  return (
    <>
      <div id="sidebar">{/* other elements */}</div>
      <div id="detail">
        <Outlet />
      </div>
    </>
  );
}
```
Now the child route should be rendering through the outlet.
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/03.webp" />
## Client Side Routing
You may or may not have noticed, but when we click the links in the sidebar, the browser is doing a full document request for the next URL instead of client side routing, which completely remounts our app.
Client side routing allows our app to update the URL without reloading the entire page. Instead, the app can immediately render new UI. Let's make it happen with [`<Link>`][link-component].
👉 **Change the sidebar `<a href>` to `<Link to>`**
```tsx filename=app/root.tsx lines=[3,20,23]
// existing imports & exports
export default function App() {
  return (
    <>
      <div id="sidebar">
        {/* other elements */}
        <nav>
          <ul>
            <li>
              <Link to={`/contacts/1`}>Your Name</Link>
            </li>
            <li>
              <Link to={`/contacts/2`}>Your Friend</Link>
            </li>
          </ul>
        </nav>
      </div>
      {/* other elements */}
    </>
  );
}
```
You can open the network tab in the browser devtools to see that it's not requesting documents anymore.
## Loading Data
URL segments, layouts, and data are more often than not coupled (tripled?) together. We can see it in this app already:
| URL Segment         | Component   | Data               |
| ------------------- | ----------- | ------------------ |
| /                   | `<App>`     | list of contacts   |
| contacts/:contactId | `<Contact>` | individual contact |
Because of this natural coupling, React Router has data conventions to get data into your route components easily.
First we'll create and export a [`clientLoader`][client-loader] function in the root route and then render the data.
👉 **Export a `clientLoader` function from `app/root.tsx` and render the data**
<docs-info>The following code has a type error in it, we'll fix it in the next section</docs-info>
```tsx filename=app/root.tsx lines=[2,6-9,11-12,19-42]
// existing imports
// existing exports
export async function clientLoader() {
  const contacts = await getContacts();
  return { contacts };
}
export default function App({ loaderData }) {
  const { contacts } = loaderData;
  return (
    <>
      <div id="sidebar">
        {/* other elements */}
        <nav>
          {contacts.length ? (
            <ul>
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <Link to={`contacts/${contact.id}`}>
                    {contact.first || contact.last ? (
                      <>
                        {contact.first} {contact.last}
                      </>
                    ) : (
                      <i>No Name</i>
                    )}
                    {contact.favorite ? (
                      <span>★</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              <i>No contacts</i>
            </p>
          )}
        </nav>
      </div>
      {/* other elements */}
    </>
  );
}
```
That's it! React Router will now automatically keep that data in sync with your UI. The sidebar should now look like this:
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/04.webp" />
You may be wondering why we're "client" loading data instead of loading the data on the server so we can do server-side rendering (SSR). Right now our contacts site is a [Single Page App][spa], so there's no server-side rendering. This makes it really easy to deploy to any static hosting provider, but we'll talk more about how to enable SSR in a bit so you can learn about all the different [rendering strategies][rendering-strategies] React Router offers.
## Type Safety
You probably noticed that we didn't assign a type to the `loaderData` prop. Let's fix that.
👉 **Add the `ComponentProps` type to the `App` component**
```tsx filename=app/root.tsx lines=[5-7]
// existing imports
// existing imports & exports
export default function App({
  loaderData,
}: Route.ComponentProps) {
  const { contacts } = loaderData;
  // existing code
}
```
Wait, what? Where did these types come from?!
We didn't define them, yet somehow they already know about the `contacts` property we returned from our `clientLoader`.
That's because React Router [generates types for each route in your app][type-safety] to provide automatic type safety.
## Adding a `HydrateFallback`
We mentioned earlier that we are working on a [Single Page App][spa] with no server-side rendering. If you look inside of [`react-router.config.ts`][react-router-config] you'll see that this is configured with a simple boolean:
```tsx filename=react-router.config.ts lines=[4]
export default {
  ssr: false,
} satisfies Config;
```
You might have started noticing that whenever you refresh the page you get a flash of white before the app loads. Since we're only rendering on the client, there's nothing to show the user while the app is loading.
👉 **Add a `HydrateFallback` export**
We can provide a fallback that will show up before the app is hydrated (rendering on the client for the first time) with a [`HydrateFallback`][hydrate-fallback] export.
```tsx filename=app/root.tsx lines=[3-10]
// existing imports & exports
export function HydrateFallback() {
  return (
    <div id="loading-splash">
      <div id="loading-splash-spinner" />
      <p>Loading, please wait...</p>
    </div>
  );
}
```
Now if you refresh the page, you'll briefly see the loading splash before the app is hydrated.
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/05.webp" />
## Index Routes
When you load the app and aren't yet on a contact page, you'll notice a big blank page on the right side of the list.
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/06.webp" />
When a route has children, and you're at the parent route's path, the `<Outlet>` has nothing to render because no children match. You can think of [index routes][index-route] as the default child route to fill in that space.
👉 **Create an index route for the root route**
```shellscript nonumber
touch app/routes/home.tsx
```
```ts filename=app/routes.ts lines=[2,5]
export default [
  index("routes/home.tsx"),
  route("contacts/:contactId", "routes/contact.tsx"),
] satisfies RouteConfig;
```
👉 **Fill in the index component's elements**
Feel free to copy/paste, nothing special here.
```tsx filename=app/routes/home.tsx
export default function Home() {
  return (
    <p id="index-page">
      This is a demo for React Router.
      <br />
      Check out{" "}
      <a href="https://reactrouter.com">
        the docs at reactrouter.com
      </a>
      .
    </p>
  );
}
```
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/07.webp" />
Voilà! No more blank space. It's common to put dashboards, stats, feeds, etc. at index routes. They can participate in data loading as well.
## Adding an About Route
Before we move on to working with dynamic data that the user can interact with, let's add a page with static content we expect to rarely change. An about page will be perfect for this.
👉 **Create the about route**
```shellscript nonumber
touch app/routes/about.tsx
```
Don't forget to add the route to `app/routes.ts`:
```tsx filename=app/routes.ts lines=[4]
export default [
  index("routes/home.tsx"),
  route("contacts/:contactId", "routes/contact.tsx"),
  route("about", "routes/about.tsx"),
] satisfies RouteConfig;
```
👉 **Add the about page UI**
Nothing too special here, just copy and paste:
```tsx filename=app/routes/about.tsx
export default function About() {
  return (
    <div id="about">
      <Link to="/">← Go to demo</Link>
      <h1>About React Router Contacts</h1>
      <div>
        <p>
          This is a demo application showing off some of the
          powerful features of React Router, including
          dynamic routing, nested routes, loaders, actions,
          and more.
        </p>
        <h2>Features</h2>
        <p>
          Explore the demo to see how React Router handles:
        </p>
        <ul>
          <li>
            Data loading and mutations with loaders and
            actions
          </li>
          <li>
            Nested routing with parent/child relationships
          </li>
          <li>URL-based routing with dynamic segments</li>
          <li>Pending and optimistic UI</li>
        </ul>
        <h2>Learn More</h2>
        <p>
          Check out the official documentation at{" "}
          <a href="https://reactrouter.com">
            reactrouter.com
          </a>{" "}
          to learn more about building great web
          applications with React Router.
        </p>
      </div>
    </div>
  );
}
```
👉 **Add a link to the about page in the sidebar**
```tsx filename=app/root.tsx lines=[5-7]
export default function App() {
  return (
    <>
      <div id="sidebar">
        <h1>
          <Link to="about">React Router Contacts</Link>
        </h1>
        {/* other elements */}
      </div>
      {/* other elements */}
    </>
  );
}
```
Now navigate to the [about page][about-page] and it should look like this:
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/08.webp" />
## Layout Routes
We don't actually want the about page to be nested inside of the sidebar layout. Let's move the sidebar to a layout so we can avoid rendering it on the about page. Additionally, we want to avoid loading all the contacts data on the about page.
👉 **Create a layout route for the sidebar**
You can name and put this layout route wherever you want, but putting it inside of a `layouts` directory will help keep things organized for our simple app.
```shellscript nonumber
mkdir app/layouts
touch app/layouts/sidebar.tsx
```
For now just return an [`<Outlet>`][outlet-component].
```tsx filename=app/layouts/sidebar.tsx
export default function SidebarLayout() {
  return <Outlet />;
}
```
👉 **Move route definitions under the sidebar layout**
We can define a `layout` route to automatically render the sidebar for all matched routes within it. This is basically what our `root` was, but now we can scope it to specific routes.
```ts filename=app/routes.ts lines=[4,9,12]
export default [
  layout("layouts/sidebar.tsx", [
    index("routes/home.tsx"),
    route("contacts/:contactId", "routes/contact.tsx"),
  ]),
  route("about", "routes/about.tsx"),
] satisfies RouteConfig;
```
👉 **Move the layout and data fetching to the sidebar layout**
We want to move the `clientLoader` and everything inside the `App` component to the sidebar layout. It should look like this:
```tsx filename=app/layouts/sidebar.tsx
export async function clientLoader() {
  const contacts = await getContacts();
  return { contacts };
}
export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
  const { contacts } = loaderData;
  return (
    <>
      <div id="sidebar">
        <h1>
          <Link to="about">React Router Contacts</Link>
        </h1>
        <div>
          <Form id="search-form" role="search">
            <input
              aria-label="Search contacts"
              id="q"
              name="q"
              placeholder="Search"
              type="search"
            />
            <div
              aria-hidden
              hidden={true}
              id="search-spinner"
            />
          </Form>
          <Form method="post">
            <button type="submit">New</button>
          </Form>
        </div>
        <nav>
          {contacts.length ? (
            <ul>
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <Link to={`contacts/${contact.id}`}>
                    {contact.first || contact.last ? (
                      <>
                        {contact.first} {contact.last}
                      </>
                    ) : (
                      <i>No Name</i>
                    )}
                    {contact.favorite ? (
                      <span>★</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              <i>No contacts</i>
            </p>
          )}
        </nav>
      </div>
      <div id="detail">
        <Outlet />
      </div>
    </>
  );
}
```
And inside `app/root.tsx`, `App` should just return an [`<Outlet>`][outlet-component], and all unused imports can be removed. Make sure there is no `clientLoader` in `root.tsx`.
```tsx filename=app/root.tsx lines=[3-10]
// existing imports and exports
export default function App() {
  return <Outlet />;
}
```
Now with that shuffling around done, our about page no longer loads contacts data nor is it nested inside of the sidebar layout:
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/09.webp" />
## Pre-rendering a Static Route
If you refresh the about page, you still see the loading spinner for just a split second before the page render on the client. This is really not a good experience, plus the page is just static information, we should be able to pre-render it as static HTML at build time.
👉 **Pre-render the about page**
Inside of `react-router.config.ts`, we can add a [`prerender`][pre-rendering] array to the config to tell React Router to pre-render certain urls at build time. In this case we just want to pre-render the about page.
```ts filename=react-router.config.ts lines=[5]
export default {
  ssr: false,
  prerender: ["/about"],
} satisfies Config;
```
Now if you go to the [about page][about-page] and refresh, you won't see the loading spinner!
<docs-warning>
If you're still seeing a spinner when you refresh, make sure you deleted the `clientLoader` in `root.tsx`.
</docs-warning>
## Server-Side Rendering
React Router is a great framework for building [Single Page Apps][spa]. Many applications are served well by only client-side rendering, and _maybe_ statically pre-rendering a few pages at build time.
If you ever do want to introduce server-side rendering into your React Router application, it's incredibly easy (remember that `ssr: false` boolean from earlier?).
👉 **Enable server-side rendering**
```ts filename=react-router.config.ts lines=[2]
export default {
  ssr: true,
  prerender: ["/about"],
} satisfies Config;
```
And now... nothing is different? We're still getting our spinner for a split second before the page renders on the client? Plus, aren't we using `clientLoader`, so our data is still being fetched on the client?
That's right! With React Router you can still use `clientLoader` (and `clientAction`) to do client-side data fetching where you see fit. React Router gives you a lot of flexibility to use the right tool for the job.
Let's switch to using [`loader`][loader], which (you guessed it) is used to fetch data on the server.
👉 **Switch to using `loader` to fetch data**
```tsx filename=app/layouts/sidebar.tsx lines=[3]
// existing imports
export async function loader() {
  const contacts = await getContacts();
  return { contacts };
}
```
Whether you set `ssr` to `true` or `false` depends on you and your users' needs. Both strategies are perfectly valid. For the remainder of this tutorial we're going to use server-side rendering, but know that all rendering strategies are first class citizens in React Router.
## URL Params in Loaders
👉 **Click on one of the sidebar links**
We should be seeing our old static contact page again, with one difference: the URL now has a real ID for the record.
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/10.webp" />
Remember the `:contactId` part of the route definition in `app/routes.ts`? These dynamic segments will match dynamic (changing) values in that position of the URL. We call these values in the URL "URL Params", or just "params" for short.
These `params` are passed to the loader with keys that match the dynamic segment. For example, our segment is named `:contactId` so the value will be passed as `params.contactId`.
These params are most often used to find a record by ID. Let's try it out.
👉 **Add a `loader` function to the contact page and access data with `loaderData`**
<docs-info>The following code has type errors in it, we'll fix them in the next section</docs-info>
```tsx filename=app/routes/contact.tsx lines=[2-3,5-8,10-13]
// existing imports
export async function loader({ params }: Route.LoaderArgs) {
  const contact = await getContact(params.contactId);
  return { contact };
}
export default function Contact({
  loaderData,
}: Route.ComponentProps) {
  const { contact } = loaderData;
  // existing code
}
// existing code
```
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/11.webp" />
## Throwing Responses
You'll notice that the type of `loaderData.contact` is `ContactRecord | null`. Based on our automatic type safety, TypeScript already knows that `params.contactId` is a string, but we haven't done anything to make sure it's a valid ID. Since the contact might not exist, `getContact` could return `null`, which is why we have type errors.
We could account for the possibility of the contact being not found in component code, but the webby thing to do is send a proper 404. We can do that in the loader and solve all of our problems at once.
```tsx filename=app/routes/contact.tsx lines=[5-7]
// existing imports
export async function loader({ params }: Route.LoaderArgs) {
  const contact = await getContact(params.contactId);
  if (!contact) {
    throw new Response("Not Found", { status: 404 });
  }
  return { contact };
}
// existing code
```
Now, if the user isn't found, code execution down this path stops and React Router renders the error path instead. Components in React Router can focus only on the happy path 😁
## Data Mutations
We'll create our first contact in a second, but first let's talk about HTML.
React Router emulates HTML Form navigation as the data mutation primitive, which used to be the only way prior to the JavaScript cambrian explosion. Don't be fooled by the simplicity! Forms in React Router give you the UX capabilities of client rendered apps with the simplicity of the "old school" web model.
While unfamiliar to some web developers, HTML `form`s actually cause a navigation in the browser, just like clicking a link. The only difference is in the request: links can only change the URL while `form`s can also change the request method (`GET` vs. `POST`) and the request body (`POST` form data).
Without client side routing, the browser will serialize the `form`'s data automatically and send it to the server as the request body for `POST`, and as [`URLSearchParams`][url-search-params] for `GET`. React Router does the same thing, except instead of sending the request to the server, it uses client side routing and sends it to the route's [`action`][action] function.
We can test this out by clicking the "New" button in our app.
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/12.webp" />
React Router sends a 405 because there is no code on the server to handle this form navigation.
## Creating Contacts
We'll create new contacts by exporting an `action` function in our root route. When the user clicks the "new" button, the form will `POST` to the root route action.
👉 **Export an `action` function from `app/root.tsx`**
```tsx filename=app/root.tsx lines=[3,5-8]
// existing imports
export async function action() {
  const contact = await createEmptyContact();
  return { contact };
}
// existing code
```
That's it! Go ahead and click the "New" button, and you should see a new record pop into the list 🥳
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/13.webp" />
The `createEmptyContact` method just creates an empty contact with no name or data or anything. But it does still create a record, promise!
> 🧐 Wait a sec ... How did the sidebar update? Where did we call the `action` function? Where's the code to re-fetch the data? Where are `useState`, `onSubmit` and `useEffect`?!
This is where the "old school web" programming model shows up. [`<Form>`][form-component] prevents the browser from sending the request to the server and sends it to your route's `action` function instead with [`fetch`][fetch].
In web semantics, a `POST` usually means some data is changing. By convention, React Router uses this as a hint to automatically revalidate the data on the page after the `action` finishes.
In fact, since it's all just HTML and HTTP, you could disable JavaScript and the whole thing will still work. Instead of React Router serializing the form and making a [`fetch`][fetch] request to your server, the browser will serialize the form and make a document request. From there React Router will render the page server side and send it down. It's the same UI in the end either way.
We'll keep JavaScript around though because we're going to make a better user experience than spinning favicons and static documents.
## Updating Data
Let's add a way to fill the information for our new record.
Just like creating data, you update data with [`<Form>`][form-component]. Let's make a new route module inside `app/routes/edit-contact.tsx`.
👉 **Create the edit contact route**
```shellscript nonumber
touch app/routes/edit-contact.tsx
```
Don't forget to add the route to `app/routes.ts`:
```tsx filename=app/routes.ts lines=[5-8]
export default [
  layout("layouts/sidebar.tsx", [
    index("routes/home.tsx"),
    route("contacts/:contactId", "routes/contact.tsx"),
    route(
      "contacts/:contactId/edit",
      "routes/edit-contact.tsx",
    ),
  ]),
  route("about", "routes/about.tsx"),
] satisfies RouteConfig;
```
👉 **Add the edit page UI**
Nothing we haven't seen before, feel free to copy/paste:
```tsx filename=app/routes/edit-contact.tsx
export async function loader({ params }: Route.LoaderArgs) {
  const contact = await getContact(params.contactId);
  if (!contact) {
    throw new Response("Not Found", { status: 404 });
  }
  return { contact };
}
export default function EditContact({
  loaderData,
}: Route.ComponentProps) {
  const { contact } = loaderData;
  return (
    <Form key={contact.id} id="contact-form" method="post">
      <p>
        <span>Name</span>
        <input
          aria-label="First name"
          defaultValue={contact.first}
          name="first"
          placeholder="First"
          type="text"
        />
        <input
          aria-label="Last name"
          defaultValue={contact.last}
          name="last"
          placeholder="Last"
          type="text"
        />
      </p>
      <label>
        <span>Twitter</span>
        <input
          defaultValue={contact.twitter}
          name="twitter"
          placeholder="@jack"
          type="text"
        />
      </label>
      <label>
        <span>Avatar URL</span>
        <input
          aria-label="Avatar URL"
          defaultValue={contact.avatar}
          name="avatar"
          placeholder="https://example.com/avatar.jpg"
          type="text"
        />
      </label>
      <label>
        <span>Notes</span>
        <textarea
          defaultValue={contact.notes}
          name="notes"
          rows={6}
        />
      </label>
      <p>
        <button type="submit">Save</button>
        <button type="button">Cancel</button>
      </p>
    </Form>
  );
}
```
Now click on your new record, then click the "Edit" button. We should see the new route.
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/14.webp" />
## Updating Contacts with `FormData`
The edit route we just created already renders a `form`. All we need to do is add the `action` function. React Router will serialize the `form`, `POST` it with [`fetch`][fetch], and automatically revalidate all the data.
👉 **Add an `action` function to the edit route**
```tsx filename=app/routes/edit-contact.tsx lines=[1,4,8,6-15]
// existing imports
export async function action({
  params,
  request,
}: Route.ActionArgs) {
  const formData = await request.formData();
  const updates = Object.fromEntries(formData);
  await updateContact(params.contactId, updates);
  return redirect(`/contacts/${params.contactId}`);
}
// existing code
```
Fill out the form, hit save, and you should see something like this! <small>(Except easier on the eyes and maybe with the patience to cut watermelon.)</small>
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/15.webp" />
## Mutation Discussion
> 😑 It worked, but I have no idea what is going on here...
Let's dig in a bit...
Open up `app/routes/edit-contact.tsx` and look at the `form` elements. Notice how they each have a name:
```tsx filename=app/routes/edit-contact.tsx lines=[4]
<input
  aria-label="First name"
  defaultValue={contact.first}
  name="first"
  placeholder="First"
  type="text"
/>
```
Without JavaScript, when a form is submitted, the browser will create [`FormData`][form-data] and set it as the body of the request when it sends it to the server. As mentioned before, React Router prevents that and emulates the browser by sending the request to your `action` function with [`fetch`][fetch] instead, including the [`FormData`][form-data].
Each field in the `form` is accessible with `formData.get(name)`. For example, given the input field from above, you could access the first and last names like this:
```tsx filename=app/routes/edit-contact.tsx  lines=[6,7] nocopy
  const firstName = formData.get("first");
  const lastName = formData.get("last");
  // ...
};
```
Since we have a handful of form fields, we used [`Object.fromEntries`][object-from-entries] to collect them all into an object, which is exactly what our `updateContact` function wants.
```tsx filename=app/routes/edit-contact.tsx nocopy
const updates = Object.fromEntries(formData);
updates.first; // "Some"
updates.last; // "Name"
```
Aside from the `action` function, none of these APIs we're discussing are provided by React Router: [`request`][request], [`request.formData`][request-form-data], [`Object.fromEntries`][object-from-entries] are all provided by the web platform.
After we finished the `action`, note the [`redirect`][redirect] at the end:
```tsx filename=app/routes/edit-contact.tsx lines=[9]
export async function action({
  params,
  request,
}: Route.ActionArgs) {
  invariant(params.contactId, "Missing contactId param");
  const formData = await request.formData();
  const updates = Object.fromEntries(formData);
  await updateContact(params.contactId, updates);
  return redirect(`/contacts/${params.contactId}`);
}
```
`action` and `loader` functions can both return a `Response` (makes sense, since they received a [`Request`][request]!). The [`redirect`][redirect] helper just makes it easier to return a [`Response`][response] that tells the app to change locations.
Without client side routing, if a server redirected after a `POST` request, the new page would fetch the latest data and render. As we learned before, React Router emulates this model and automatically revalidates the data on the page after the `action` call. That's why the sidebar automatically updates when we save the form. The extra revalidation code doesn't exist without client side routing, so it doesn't need to exist with client side routing in React Router either!
One last thing. Without JavaScript, the [`redirect`][redirect] would be a normal redirect. However, with JavaScript it's a client-side redirect, so the user doesn't lose client state like scroll positions or component state.
## Redirecting new records to the edit page
Now that we know how to redirect, let's update the action that creates new contacts to redirect to the edit page:
👉 **Redirect to the new record's edit page**
```tsx filename=app/root.tsx lines=[6,12]
// existing imports
export async function action() {
  const contact = await createEmptyContact();
  return redirect(`/contacts/${contact.id}/edit`);
}
// existing code
```
Now when we click "New", we should end up on the edit page:
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/16.webp" />
## Active Link Styling
Now that we have a bunch of records, it's not clear which one we're looking at in the sidebar. We can use [`NavLink`][nav-link] to fix this.
👉 **Replace `<Link>` with `<NavLink>` in the sidebar**
```tsx filename=app/layouts/sidebar.tsx lines=[1,17-26,28]
// existing imports and exports
export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
  const { contacts } = loaderData;
  return (
    <>
      <div id="sidebar">
        {/* existing elements */}
        <ul>
          {contacts.map((contact) => (
            <li key={contact.id}>
              <NavLink
                className={({ isActive, isPending }) =>
                  isActive
                    ? "active"
                    : isPending
                      ? "pending"
                      : ""
                }
                to={`contacts/${contact.id}`}
              >
                {/* existing elements */}
              </NavLink>
            </li>
          ))}
        </ul>
        {/* existing elements */}
      </div>
      {/* existing elements */}
    </>
  );
}
```
Note that we are passing a function to `className`. When the user is at the URL that matches `<NavLink to>`, then `isActive` will be true. When it's _about_ to be active (the data is still loading) then `isPending` will be true. This allows us to easily indicate where the user is and also provide immediate feedback when links are clicked but data needs to be loaded.
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/17.webp" />
## Global Pending UI
As the user navigates the app, React Router will _leave the old page up_ as data is loading for the next page. You may have noticed the app feels a little unresponsive as you click between the list. Let's provide the user with some feedback so the app doesn't feel unresponsive.
React Router is managing all the state behind the scenes and reveals the pieces you need to build dynamic web apps. In this case, we'll use the [`useNavigation`][use-navigation] hook.
👉 **Use `useNavigation` to add global pending UI**
```tsx filename=app/layouts/sidebar.tsx lines=[6,13,19-21]
export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
  const { contacts } = loaderData;
  const navigation = useNavigation();
  return (
    <>
      {/* existing elements */}
      <div
        className={
          navigation.state === "loading" ? "loading" : ""
        }
        id="detail"
      >
        <Outlet />
      </div>
    </>
  );
}
```
[`useNavigation`][use-navigation] returns the current navigation state: it can be one of `"idle"`, `"loading"` or `"submitting"`.
In our case, we add a `"loading"` class to the main part of the app if we're not idle. The CSS then adds a nice fade after a short delay (to avoid flickering the UI for fast loads). You could do anything you want though, like show a spinner or loading bar across the top.
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/18.webp" />
## Deleting Records
If we review code in the contact route, we can find the delete button looks like this:
```tsx filename=app/routes/contact.tsx lines=[2]
<Form
  action="destroy"
  method="post"
  onSubmit={(event) => {
    const response = confirm(
      "Please confirm you want to delete this record.",
    );
    if (!response) {
      event.preventDefault();
    }
  }}
>
  <button type="submit">Delete</button>
</Form>
```
Note the `action` points to `"destroy"`. Like `<Link to>`, `<Form action>` can take a _relative_ value. Since the form is rendered in the route `contacts/:contactId`, then a relative action with `destroy` will submit the form to `contacts/:contactId/destroy` when clicked.
At this point you should know everything you need to know to make the delete button work. Maybe give it a shot before moving on? You'll need:
1. A new route
2. An `action` at that route
3. `deleteContact` from `app/data.ts`
4. `redirect` to somewhere after
👉 **Configure the "destroy" route module**
```shellscript nonumber
touch app/routes/destroy-contact.tsx
```
```tsx filename=app/routes.ts lines=[3-6]
export default [
  // existing routes
  route(
    "contacts/:contactId/destroy",
    "routes/destroy-contact.tsx",
  ),
  // existing routes
] satisfies RouteConfig;
```
👉 **Add the destroy action**
```tsx filename=app/routes/destroy-contact.tsx
export async function action({ params }: Route.ActionArgs) {
  await deleteContact(params.contactId);
  return redirect("/");
}
```
Alright, navigate to a record and click the "Delete" button. It works!
> 😅 I'm still confused why this all works
When the user clicks the submit button:
1. `<Form>` prevents the default browser behavior of sending a new document `POST` request to the server, but instead emulates the browser by creating a `POST` request with client side routing and [`fetch`][fetch]
2. The `<Form action="destroy">` matches the new route at `contacts/:contactId/destroy` and sends it the request
3. After the `action` redirects, React Router calls all the `loader`s for the data on the page to get the latest values (this is "revalidation"). `loaderData` in `routes/contact.tsx` now has new values and causes the components to update!
Add a `Form`, add an `action`, React Router does the rest.
## Cancel Button
On the edit page we've got a cancel button that doesn't do anything yet. We'd like it to do the same thing as the browser's back button.
We'll need a click handler on the button as well as [`useNavigate`][use-navigate].
👉 **Add the cancel button click handler with `useNavigate`**
```tsx filename=app/routes/edit-contact.tsx lines=[1,8,15]
// existing imports & exports
export default function EditContact({
  loaderData,
}: Route.ComponentProps) {
  const { contact } = loaderData;
  const navigate = useNavigate();
  return (
    <Form key={contact.id} id="contact-form" method="post">
      {/* existing elements */}
      <p>
        <button type="submit">Save</button>
        <button onClick={() => navigate(-1)} type="button">
          Cancel
        </button>
      </p>
    </Form>
  );
}
```
Now when the user clicks "Cancel", they'll be sent back one entry in the browser's history.
> 🧐 Why is there no `event.preventDefault()` on the button?
A `<button type="button">`, while seemingly redundant, is the HTML way of preventing a button from submitting its form.
Two more features to go. We're on the home stretch!
## `URLSearchParams` and `GET` Submissions
All of our interactive UI so far have been either links that change the URL or `form`s that post data to `action` functions. The search field is interesting because it's a mix of both: it's a `form`, but it only changes the URL, it doesn't change data.
Let's see what happens when we submit the search form:
👉 **Type a name into the search field and hit the enter key**
Note the browser's URL now contains your query in the URL as [`URLSearchParams`][url-search-params]:
```
http://localhost:5173/?q=ryan
```
Since it's not `<Form method="post">`, React Router emulates the browser by serializing the [`FormData`][form-data] into the [`URLSearchParams`][url-search-params] instead of the request body.
`loader` functions have access to the search params from the `request`. Let's use it to filter the list:
👉 **Filter the list if there are `URLSearchParams`**
```tsx filename=app/layouts/sidebar.tsx lines=[3-8]
// existing imports & exports
export async function loader({
  request,
}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const contacts = await getContacts(q);
  return { contacts };
}
// existing code
```
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/19.webp" />
Because this is a `GET`, not a `POST`, React Router _does not_ call the `action` function. Submitting a `GET` `form` is the same as clicking a link: only the URL changes.
This also means it's a normal page navigation. You can click the back button to get back to where you were.
## Synchronizing URLs to Form State
There are a couple of UX issues here that we can take care of quickly.
1. If you click back after a search, the form field still has the value you entered even though the list is no longer filtered.
2. If you refresh the page after searching, the form field no longer has the value in it, even though the list is filtered
In other words, the URL and our input's state are out of sync.
Let's solve (2) first and start the input with the value from the URL.
👉 **Return `q` from your `loader`, set it as the input's default value**
```tsx filename=app/layouts/sidebar.tsx lines=[9,15,26]
// existing imports & exports
export async function loader({
  request,
}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const contacts = await getContacts(q);
  return { contacts, q };
}
export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
  const { contacts, q } = loaderData;
  const navigation = useNavigation();
  return (
    <>
      <div id="sidebar">
        {/* existing elements */}
        <div>
          <Form id="search-form" role="search">
            <input
              aria-label="Search contacts"
              defaultValue={q || ""}
              id="q"
              name="q"
              placeholder="Search"
              type="search"
            />
            {/* existing elements */}
          </Form>
          {/* existing elements */}
        </div>
        {/* existing elements */}
      </div>
      {/* existing elements */}
    </>
  );
}
```
The input field will show the query if you refresh the page after a search now.
Now for problem (1), clicking the back button and updating the input. We can bring in `useEffect` from React to manipulate the input's value in the DOM directly.
👉 **Synchronize input value with the `URLSearchParams`**
```tsx filename=app/layouts/sidebar.tsx lines=[2,12-17]
// existing imports
// existing imports & exports
export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
  const { contacts, q } = loaderData;
  const navigation = useNavigation();
  useEffect(() => {
    const searchField = document.getElementById("q");
    if (searchField instanceof HTMLInputElement) {
      searchField.value = q || "";
    }
  }, [q]);
  // existing code
}
```
> 🤔 Shouldn't you use a controlled component and React State for this?
You could certainly do this as a controlled component. You will have more synchronization points, but it's up to you.
<details>
<summary>Expand this to see what it would look like</summary>
```tsx filename=app/layouts/sidebar.tsx lines=[2,11-12,14-18,30-33,36-37]
// existing imports
// existing imports & exports
export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
  const { contacts, q } = loaderData;
  const navigation = useNavigation();
  // the query now needs to be kept in state
  const [query, setQuery] = useState(q || "");
  // we still have a `useEffect` to synchronize the query
  // to the component state on back/forward button clicks
  useEffect(() => {
    setQuery(q || "");
  }, [q]);
  return (
    <>
      <div id="sidebar">
        {/* existing elements */}
        <div>
          <Form id="search-form" role="search">
            <input
              aria-label="Search contacts"
              id="q"
              name="q"
              // synchronize user's input to component state
              onChange={(event) =>
                setQuery(event.currentTarget.value)
              }
              placeholder="Search"
              type="search"
              // switched to `value` from `defaultValue`
              value={query}
            />
            {/* existing elements */}
          </Form>
          {/* existing elements */}
        </div>
        {/* existing elements */}
      </div>
      {/* existing elements */}
    </>
  );
}
```
</details>
Alright, you should now be able to click the back/forward/refresh buttons and the input's value should be in sync with the URL and results.
## Submitting `Form`'s `onChange`
We've got a product decision to make here. Sometimes you want the user to submit the `form` to filter some results, other times you want to filter as the user types. We've already implemented the first, so let's see what it's like for the second.
We've seen `useNavigate` already, we'll use its cousin, [`useSubmit`][use-submit], for this.
```tsx filename=app/layouts/sidebar.tsx lines=[7,16,27-29]
// existing imports & exports
export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
  const { contacts, q } = loaderData;
  const navigation = useNavigation();
  const submit = useSubmit();
  // existing code
  return (
    <>
      <div id="sidebar">
        {/* existing elements */}
        <div>
          <Form
            id="search-form"
            onChange={(event) =>
              submit(event.currentTarget)
            }
            role="search"
          >
            {/* existing elements */}
          </Form>
          {/* existing elements */}
        </div>
        {/* existing elements */}
      </div>
      {/* existing elements */}
    </>
  );
}
```
As you type, the `form` is automatically submitted now!
Note the argument to [`submit`][use-submit]. The `submit` function will serialize and submit any form you pass to it. We're passing in `event.currentTarget`. The `currentTarget` is the DOM node the event is attached to (the `form`).
## Adding Search Spinner
In a production app, it's likely this search will be looking for records in a database that is too large to send all at once and filter client side. That's why this demo has some faked network latency.
Without any loading indicator, the search feels kinda sluggish. Even if we could make our database faster, we'll always have the user's network latency in the way and out of our control.
For a better user experience, let's add some immediate UI feedback for the search. We'll use [`useNavigation`][use-navigation] again.
👉 **Add a variable to know if we're searching**
```tsx filename=app/layouts/sidebar.tsx lines=[9-13]
// existing imports & exports
export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
  const { contacts, q } = loaderData;
  const navigation = useNavigation();
  const submit = useSubmit();
  const searching =
    navigation.location &&
    new URLSearchParams(navigation.location.search).has(
      "q",
    );
  // existing code
}
```
When nothing is happening, `navigation.location` will be `undefined`, but when the user navigates it will be populated with the next location while data loads. Then we check if they're searching with `location.search`.
👉 **Add classes to search form elements using the new `searching` state**
```tsx filename=app/layouts/sidebar.tsx lines=[22,31]
// existing imports & exports
export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
  // existing code
  return (
    <>
      <div id="sidebar">
        {/* existing elements */}
        <div>
          <Form
            id="search-form"
            onChange={(event) =>
              submit(event.currentTarget)
            }
            role="search"
          >
            <input
              aria-label="Search contacts"
              className={searching ? "loading" : ""}
              defaultValue={q || ""}
              id="q"
              name="q"
              placeholder="Search"
              type="search"
            />
            <div
              aria-hidden
              hidden={!searching}
              id="search-spinner"
            />
          </Form>
          {/* existing elements */}
        </div>
        {/* existing elements */}
      </div>
      {/* existing elements */}
    </>
  );
}
```
Bonus points, avoid fading out the main screen when searching:
```tsx filename=app/layouts/sidebar.tsx lines=[13]
// existing imports & exports
export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
  // existing code
  return (
    <>
      {/* existing elements */}
      <div
        className={
          navigation.state === "loading" && !searching
            ? "loading"
            : ""
        }
        id="detail"
      >
        <Outlet />
      </div>
      {/* existing elements */}
    </>
  );
}
```
You should now have a nice spinner on the left side of the search input.
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/20.webp" />
## Managing the History Stack
Since the form is submitted for every keystroke, typing the characters "alex" and then deleting them with backspace results in a huge history stack 😂. We definitely don't want this:
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/21.webp" />
We can avoid this by _replacing_ the current entry in the history stack with the next page, instead of pushing into it.
👉 **Use `replace` in `submit`**
```tsx filename=app/layouts/sidebar.tsx lines=[16-19]
// existing imports & exports
export default function SidebarLayout({
  loaderData,
}: Route.ComponentProps) {
  // existing code
  return (
    <>
      <div id="sidebar">
        {/* existing elements */}
        <div>
          <Form
            id="search-form"
            onChange={(event) => {
              const isFirstSearch = q === null;
              submit(event.currentTarget, {
                replace: !isFirstSearch,
              });
            }}
            role="search"
          >
            {/* existing elements */}
          </Form>
          {/* existing elements */}
        </div>
        {/* existing elements */}
      </div>
      {/* existing elements */}
    </>
  );
}
```
After a quick check if this is the first search or not, we decide to replace. Now the first search will add a new entry, but every keystroke after that will replace the current entry. Instead of clicking back 7 times to remove the search, users only have to click back once.
## `Form`s Without Navigation
So far all of our forms have changed the URL. While these user flows are common, it's equally common to want to submit a form _without_ causing a navigation.
For these cases, we have [`useFetcher`][use-fetcher]. It allows us to communicate with `action`s and `loader`s without causing a navigation.
The ★ button on the contact page makes sense for this. We aren't creating or deleting a new record, and we don't want to change pages. We simply want to change the data on the page we're looking at.
👉 **Change the `<Favorite>` form to a fetcher form**
```tsx filename=app/routes/contact.tsx lines=[1,10,14,26]
// existing imports & exports
function Favorite({
  contact,
}: {
  contact: Pick<ContactRecord, "favorite">;
}) {
  const fetcher = useFetcher();
  const favorite = contact.favorite;
  return (
    <fetcher.Form method="post">
      <button
        aria-label={
          favorite
            ? "Remove from favorites"
            : "Add to favorites"
        }
        name="favorite"
        value={favorite ? "false" : "true"}
      >
        {favorite ? "★" : "☆"}
      </button>
    </fetcher.Form>
  );
}
```
This form will no longer cause a navigation, but simply fetch to the `action`. Speaking of which ... this won't work until we create the `action`.
👉 **Create the `action`**
```tsx filename=app/routes/contact.tsx lines=[2,5-13]
// existing imports
// existing imports
export async function action({
  params,
  request,
}: Route.ActionArgs) {
  const formData = await request.formData();
  return updateContact(params.contactId, {
    favorite: formData.get("favorite") === "true",
  });
}
// existing code
```
Alright, we're ready to click the star next to the user's name!
<img class="tutorial" loading="lazy" src="/_docs/v7_address_book_tutorial/22.webp" />
Check that out, both stars automatically update. Our new `<fetcher.Form method="post">` works almost exactly like the `<Form>` we've been using: it calls the action and then all data is revalidated automatically — even your errors will be caught the same way.
There is one key difference though, it's not a navigation, so the URL doesn't change and the history stack is unaffected.
## Optimistic UI
You probably noticed the app felt kind of unresponsive when we clicked the favorite button from the last section. Once again, we added some network latency because you're going to have it in the real world.
To give the user some feedback, we could put the star into a loading state with `fetcher.state` (a lot like `navigation.state` from before), but we can do something even better this time. We can use a strategy called "Optimistic UI".
The fetcher knows the [`FormData`][form-data] being submitted to the `action`, so it's available to you on `fetcher.formData`. We'll use that to immediately update the star's state, even though the network hasn't finished. If the update eventually fails, the UI will revert to the real data.
👉 **Read the optimistic value from `fetcher.formData`**
```tsx filename=app/routes/contact.tsx lines=[9-11]
// existing code
function Favorite({
  contact,
}: {
  contact: Pick<ContactRecord, "favorite">;
}) {
  const fetcher = useFetcher();
  const favorite = fetcher.formData
    ? fetcher.formData.get("favorite") === "true"
    : contact.favorite;
  return (
    <fetcher.Form method="post">
      <button
        aria-label={
          favorite
            ? "Remove from favorites"
            : "Add to favorites"
        }
        name="favorite"
        value={favorite ? "false" : "true"}
      >
        {favorite ? "★" : "☆"}
      </button>
    </fetcher.Form>
  );
}
```
Now the star _immediately_ changes to the new state when you click it.
---
That's it! Thanks for giving React Router a shot. We hope this tutorial gives you a solid start to build great user experiences. There's a lot more you can do, so make sure to check out all the [APIs][react-router-apis] 😀
[http-localhost-5173]: http://localhost:5173
[root-route]: ../explanation/special-files#roottsx
[error-boundaries]: ../how-to/error-boundary
[links]: ../start/framework/route-module#links
[outlet-component]: https://api.reactrouter.com/v7/functions/react-router.Outlet
[file-route-conventions]: ../how-to/file-route-conventions
[contacts-1]: http://localhost:5173/contacts/1
[link-component]: https://api.reactrouter.com/v7/functions/react-router.Link
[client-loader]: ../start/framework/route-module#clientloader
[spa]: ../how-to/spa
[type-safety]: ../explanation/type-safety
[react-router-config]: ../explanation/special-files#react-routerconfigts
[rendering-strategies]: ../start/framework/rendering
[index-route]: ../start/framework/routing#index-routes
[layout-route]: ../start/framework/routing#layout-routes
[hydrate-fallback]: ../start/framework/route-module#hydratefallback
[about-page]: http://localhost:5173/about
[pre-rendering]: ../how-to/pre-rendering
[url-search-params]: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
[loader]: ../start/framework/route-module#loader
[action]: ../start/framework/route-module#action
[form-component]: https://api.reactrouter.com/v7/functions/react-router.Form
[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/fetch
[form-data]: https://developer.mozilla.org/en-US/docs/Web/API/FormData
[object-from-entries]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries
[request-form-data]: https://developer.mozilla.org/en-US/docs/Web/API/Request/formData
[request]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[redirect]: https://api.reactrouter.com/v7/functions/react-router.redirect
[response]: https://developer.mozilla.org/en-US/docs/Web/API/Response
[nav-link]: https://api.reactrouter.com/v7/functions/react-router.NavLink
[use-navigation]: https://api.reactrouter.com/v7/functions/react-router.useNavigation
[use-navigate]: https://api.reactrouter.com/v7/functions/react-router.useNavigate
[use-submit]: https://api.reactrouter.com/v7/functions/react-router.useSubmit
[use-fetcher]: https://api.reactrouter.com/v7/functions/react-router.useFetcher
[react-router-apis]: https://api.reactrouter.com/v7/modules/react_router

---

## Page 198 — `docs/tutorials/advanced-data-fetching.md`

Live URL: https://reactrouter.com/tutorials/advanced-data-fetching

# Advanced Data Fetching
<docs-warning>
  This document is a work in progress. There's not much to see here (yet).
</docs-warning>

---

## Page 199 — `docs/tutorials/index.md`

Live URL: https://reactrouter.com/tutorials/index



---

## Page 200 — `docs/tutorials/quickstart.md`

Live URL: https://reactrouter.com/tutorials/quickstart

# Quick Start
[MODES: framework]
<br />
<br />
This guide will familiarize you with the basic plumbing required to run a React Router app as quickly as possible. While there are many starter templates with different runtimes, deploy targets, and databases, we're going to create a bare-bones project from scratch.
## Installation
If you prefer to initialize a batteries-included React Router project, you can use the `create-react-router` CLI to get started with any of our [templates][templates]:
```shellscript nonumber
npx create-react-router@latest
```
However, this guide will explain everything the CLI does to set up your project. Instead of using the CLI, you can follow these steps. If you're just getting started with React Router, we recommend following this guide to understand all the different pieces that make up a React Router app.
```shellscript nonumber
mkdir my-react-router-app
cd my-react-router-app
npm init -y
# install runtime dependencies
npm i react-router @react-router/node @react-router/serve isbot react react-dom
# install dev dependencies
npm i -D @react-router/dev vite
```
## Vite Config
```shellscript nonumber
touch vite.config.js
```
Since React Router uses [Vite], you'll need to provide a [Vite config][vite-config] with the React Router Vite plugin. Here's the basic configuration you'll need:
```js filename=vite.config.js
export default defineConfig({
  plugins: [reactRouter()],
});
```
## The Root Route
```shellscript nonumber
mkdir app
touch app/root.jsx
```
`app/root.jsx` is what we call the "Root Route". It's the root layout of your entire app. Here's the basic set of elements you'll need for any project:
```jsx filename=app/root.jsx
export default function App() {
  return (
    <html>
      <head>
        <link
          rel="icon"
          href="data:image/x-icon;base64,AA"
        />
      </head>
      <body>
        <h1>Hello world!</h1>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
```
## Additional Routes
```shellscript nonumber
touch app/routes.js
```
`app/routes.js` is where you define your routes. This guide focuses on the minimal setup to get a React Router app up and running, so we don't need to define any routes and can just export an empty array:
```js filename=app/routes.js
export default [];
```
The existence of `routes.js` is required to build a React Router app; if you're using React Router, we assume you'll want to do some routing eventually. You can read more about defining routes in our [Routing][routing] guide.
## Build and Run
First, you will need to specify the type as `module` in `package.json` to satisfy ES module requirements for `react-router` and future versions of Vite.
```shellscript nonumber
npm pkg set type="module"
```
Next build the app for production:
```shellscript nonumber
npx react-router build
```
You should now see a `build` folder containing a `server` folder (the server version of your app) and a `client` folder (the browser version) with some build artifacts in them. (This is all [configurable][react-router-config].)
👉 **Run the app with `react-router-serve`**
Now you can run your app with `react-router-serve`, provided by the `@react-router/serve` package:
```shellscript nonumber
npx react-router-serve build/server/index.js
```
You should be able to open up [http://localhost:3000][http-localhost-3000] and see the "hello world" page.
Aside from the unholy amount of code in `node_modules`, our React Router app is just four files:
```
├── app/
│   ├── root.jsx
│   └── routes.js
├── package.json
└── vite.config.js
```
## Bring Your Own Server
The `build/server` directory created by `react-router build` is just a module that you run inside a server like Express, Cloudflare Workers, Netlify, Vercel, Fastly, AWS, Deno, Azure, Fastify, Firebase, ... anywhere.
<docs-info>
You can also use React Router as a Single Page Application with no server. For more information, see our guide on [Single Page Apps][spa].
</docs-info>
If you don't care to set up your own server, you can use `@react-router/serve`. It's a simple `express`-based server maintained by the React Router maintainers. However, React Router is specifically designed to run in _any_ JavaScript environment so that you own your stack. It is expected many —if not most— production apps will have their own server.
Just for kicks, let's stop using `@react-router/serve` and use `express` instead.
👉 **Install Express, the React Router Express adapter, and [cross-env] for running in production mode**
```shellscript nonumber
npm i express @react-router/express cross-env
# not going to use this anymore
npm uninstall @react-router/serve
```
👉 **Create an Express server**
```shellscript nonumber
touch server.js
```
```js filename=server.js
const app = express();
app.use(express.static("build/client"));
// notice that your app is "just a request handler"
app.use(
  createRequestHandler({
    // and the result of `react-router build` is "just a module"
    build: await import("./build/server/index.js"),
  }),
);
app.listen(3000, () => {
  console.log("App listening on http://localhost:3000");
});
```
👉 **Run your app with `express`**
```shellscript nonumber
node server.js
```
Now that you own your server, you can debug your app with whatever tooling your server has. For example, you can inspect your app with Chrome DevTools using the [Node.js inspect flag][inspect]:
```shellscript nonumber
node --inspect server.js
```
## Development Workflow
Instead of stopping, rebuilding, and starting your server all the time, you can run React Router in development using [Vite in middleware mode][vite-middleware]. This enables instant feedback to changes in your app with React Refresh (Hot Module Replacement) and React Router Hot Data Revalidation.
First, as a convenience, add `dev` and `start` commands in `package.json` that will run your server in development and production modes respectively:
👉 **Add a "scripts" entry to `package.json`**
```jsonc filename=package.json lines=[2-4] nocopy
{
  "scripts": {
    "dev": "node ./server.js",
    "start": "cross-env NODE_ENV=production node ./server.js",
  },
  // ...
}
```
👉 **Add Vite development middleware to your server**
Vite middleware is not applied if `process.env.NODE_ENV` is set to `"production"`, in which case you'll still be running the regular build output as you did earlier.
```js filename=server.js lines=[6,13-28]
const app = express();
if (process.env.NODE_ENV === "production") {
  app.use(express.static("build/client"));
  app.use(
    createRequestHandler({
      build: await import("./build/server/index.js"),
    }),
  );
} else {
  const viteDevServer = await import("vite").then((vite) =>
    vite.createServer({
      server: { middlewareMode: true },
    }),
  );
  app.use(viteDevServer.middlewares);
  app.use(
    createRequestHandler({
      build: () =>
        viteDevServer.ssrLoadModule(
          "virtual:react-router/server-build",
        ),
    }),
  );
}
app.listen(3000, () => {
  console.log(`Server is running on http://localhost:3000`);
});
```
👉 **Start the dev server**
```shellscript nonumber
npm run dev
```
Now you can work on your app with immediate feedback. Give it a try by changing the text in `root.jsx` and watch the changes appear instantly!
## Controlling Server and Browser Entries
There are default magic files React Router is using that most apps don't need to mess with, but if you want to customize React Router's entry points to the server and browser you can run `react-router reveal` and they'll get dumped into your project.
```shellscript nonumber
npx react-router reveal
```
```
Entry file entry.client created at app/entry.client.tsx.
Entry file entry.server created at app/entry.server.tsx.
```
## Summary
Congrats, you can add React Router to your resume! Summing things up, we've learned:
- React Router framework mode compiles your app into two things:
  - A request handler that you add to your own JavaScript server
  - A pile of static assets in your public directory for the browser
- You can bring your own server with adapters to deploy anywhere
- You can set up a development workflow with HMR built-in
In general, React Router is a bit "guts out". It requires a few minutes of boilerplate, but now you own your stack.
What's next?
- [Address Book Tutorial][address-book-tutorial]
[templates]: ../start/framework/deploying#templates
[spa]: ../how-to/spa
[inspect]: https://nodejs.org/en/docs/guides/debugging-getting-started/
[vite-config]: https://vite.dev/config
[routing]: ../start/framework/routing
[http-localhost-3000]: http://localhost:3000
[vite]: https://vitejs.dev
[react-router-config]: https://api.reactrouter.com/v7/types/_react-router_dev.config.Config.html
[vite-middleware]: https://vitejs.dev/guide/ssr#setting-up-the-dev-server
[cross-env]: https://www.npmjs.com/package/cross-env
[address-book-tutorial]: ./address-book

---

## Page 201 — `docs/upgrading/component-routes.md`

Live URL: https://reactrouter.com/upgrading/component-routes

# Framework Adoption from Component Routes
If you are using `<RouterProvider>` please see [Framework Adoption from RouterProvider][upgrade-router-provider] instead.
If you are using `<Routes>` this is the right place.
The React Router Vite plugin adds framework features to React Router. This guide will help you adopt the plugin in your app. If you run into any issues, please reach out for help on [Twitter](https://x.com/remix_run) or [Discord](https://rmx.as/discord).
## Features
The Vite plugin adds:
- Route loaders, actions, and automatic data revalidation
- Type-safe Routes Modules
- Automatic route code-splitting
- Automatic scroll restoration across navigations
- Optional Static pre-rendering
- Optional Server rendering
The initial setup requires the most work. However, once complete, you can adopt new features incrementally, one route at a time.
## Prerequisites
To use the Vite plugin, your project requires:
- Node.js 20+ (if using Node as your runtime)
- Vite 5+
## 1. Install the Vite plugin
**👉 Install the React Router Vite plugin**
```shellscript nonumber
npm install -D @react-router/dev
```
**👉 Install a runtime adapter**
We will assume you are using Node as your runtime.
```shellscript nonumber
npm install @react-router/node
```
**👉 Swap out the React plugin for React Router.**
```diff filename=vite.config.ts
-import react from '@vitejs/plugin-react'
+import { reactRouter } from "@react-router/dev/vite";
export default defineConfig({
  plugins: [
-    react()
+    reactRouter()
  ],
});
```
## 2. Add the React Router config
**👉 Create a `react-router.config.ts` file**
Add the following to the root of your project. In this config you can tell React Router about your project, like where to find the app directory and to not use SSR (server-side rendering) for now.
```shellscript nonumber
touch react-router.config.ts
```
```ts filename=react-router.config.ts
export default {
  appDirectory: "src",
  ssr: false,
} satisfies Config;
```
## 3. Add the Root entry point
In a typical Vite app, the `index.html` file is the entry point for bundling. The React Router Vite plugin moves the entry point to a `root.tsx` file so you can use React to render the shell of your app instead of static HTML, and eventually upgrade to Server Rendering if you want.
**👉 Move your existing `index.html` to `root.tsx`**
For example, if your current `index.html` looks like this:
```html filename=index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
You would move that markup into `src/root.tsx` and delete `index.html`:
```shellscript nonumber
touch src/root.tsx
```
```tsx filename=src/root.tsx
export function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>My App</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
export default function Root() {
  return <Outlet />;
}
```
## 4. Add client entry module
In the typical Vite app the `index.html` file points to `src/main.tsx` as the client entry point. React Router uses a file named `src/entry.client.tsx` instead.
**👉 Make `src/entry.client.tsx` your entry point**
If your current `src/main.tsx` looks like this:
```tsx filename=src/main.tsx
ReactDOM.createRoot(
  document.getElementById("root")!,
).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```
You would rename it to `entry.client.tsx` and change it to this:
```tsx filename=src/entry.client.tsx
ReactDOM.hydrateRoot(
  document,
  <React.StrictMode>
    <HydratedRouter />
  </React.StrictMode>,
);
```
- Use `hydrateRoot` instead of `createRoot`
- Render a `<HydratedRouter>` instead of your `<App/>` component
- Note: we stopped rendering the `<App/>` component. We'll bring it back in a later step, but first we want to get the app to boot with the new entry point.
## 5. Shuffle stuff around
Between `root.tsx` and `entry.client.tsx`, you may want to shuffle some stuff around between them.
In general:
- `root.tsx` contains any rendering things like context providers, layouts, styles, etc.
- `entry.client.tsx` should be as minimal as possible
- Remember to _not_ try to render your existing `<App/>` component yet, we'll do that in a later step
Note that your `root.tsx` file will be statically generated and served as the entry point of your app, so just that module will need to be compatible with server rendering. This is where most of your trouble will come.
## 6. Set up your routes
The React Router Vite plugin uses a `routes.ts` file to configure your routes. For now we'll add a simple catchall route to get things going.
**👉 Set up a `catchall.tsx` route**
```shellscript nonumber
touch src/routes.ts src/catchall.tsx
```
```ts filename=src/routes.ts
export default [
  // * matches all URLs, the ? makes it optional so it will match / as well
  route("*?", "catchall.tsx"),
] satisfies RouteConfig;
```
**👉 Render a placeholder route**
Eventually we'll replace this with our original `App` component, but for now we'll just render something simple to make sure we can boot the app.
```tsx filename=src/catchall.tsx
export default function Component() {
  return <div>Hello, world!</div>;
}
```
[View our guide on configuring routes][configuring-routes] to learn more about the `routes.ts` file.
## 7. Boot the app
At this point you should be able to boot the app and see the root layout.
**👉 Add `dev` script and run the app**
```json filename=package.json
"scripts": {
  "dev": "react-router dev"
}
```
Now make sure you can boot your app at this point before moving on:
```shellscript
npm run dev
```
You will probably want to add `.react-router/` to your `.gitignore` file to avoid tracking unnecessary files in your repository.
```txt
.react-router/
```
You can check out [Type Safety][type-safety] to learn how to fully set up and use autogenerated type safety for params, loader data, and more.
## 8. Render your app
To get back to rendering your app, we'll update the "catchall" route we set up earlier that matches all URLs so that your existing `<Routes>` get a chance to render.
**👉 Update the catchall route to render your app**
```tsx filename=src/catchall.tsx
export default function Component() {
  return <App />;
}
```
Your app should be back on the screen and working as usual!
## 9. Migrate a route to a Route Module
You can now incrementally migrate your routes to route modules.
Given an existing route like this:
```tsx filename=src/App.tsx
// ...
export default function App() {
  return (
    <Routes>
      <Route path="/about" element={<About />} />
    </Routes>
  );
}
```
**👉 Add the route definition to `routes.ts`**
```tsx filename=src/routes.ts
export default [
  route("/about", "./pages/about.tsx"),
  route("*?", "catchall.tsx"),
] satisfies RouteConfig;
```
**👉 Add the route module**
Edit the route module to use the [Route Module API][route-modules]:
```tsx filename=src/pages/about.tsx
export async function clientLoader() {
  // you can now fetch data here
  return {
    title: "About page",
  };
}
export default function Component({ loaderData }) {
  return <h1>{loaderData.title}</h1>;
}
```
See [Type Safety][type-safety] to set up autogenerated type safety for params, loader data, and more.
The first few routes you migrate are the hardest because you often have to access various abstractions a bit differently than before (like in a loader instead of from a hook or context). But once the trickiest bits get dealt with, you get into an incremental groove.
## Enable SSR and/or Pre-rendering
If you want to enable server rendering and static pre-rendering, you can do so with the `ssr` and `prerender` options in the bundler plugin. For SSR you'll need to also deploy the server build to a server.
```ts filename=react-router.config.ts
export default {
  ssr: true,
  async prerender() {
    return ["/", "/about", "/contact"];
  },
} satisfies Config;
```
[upgrade-router-provider]: ./router-provider
[configuring-routes]: ../start/framework/routing
[route-modules]: ../start/framework/route-module
[type-safety]: ../how-to/route-module-type-safety

---

## Page 202 — `docs/upgrading/future.md`

Live URL: https://reactrouter.com/upgrading/future

# Future Flags and Deprecations
This guide walks you through the process of adopting future flags in your React Router app. By following this strategy, you will be able to upgrade to the next major version of React Router with minimal changes. To read more about future flags see [API Development Strategy][api-development-strategy].
We highly recommend you make a commit after each step and ship it instead of doing everything all at once. Most flags can be adopted in any order, with exceptions noted below.
## Update to latest v7.x
First update to the latest minor version of v7.x to have the latest future flags. You may see a number of deprecation warnings as you upgrade, which we'll cover below.
👉 Update to latest v7
```sh
npm install react-router@7 @react-router/{dev,node,etc.}@7
```
## `future.v8_middleware`
[MODES: framework, data]
<br/>
<br/>
**Background**
Middleware allows you to run code before and after the [`Response`][Response] generation for the matched path. This enables common patterns like authentication, logging, error handling, and data preprocessing in a reusable way. Please see the [docs](../how-to/middleware) for more information.
👉 **Enable the Flag**
In Framework mode:
```ts filename=react-router.config.ts
export default {
  future: {
    v8_middleware: true,
  },
} satisfies Config;
```
In Data mode:
```ts
const router = createBrowserRouter(routes, {
  future: {
    v8_middleware: true,
  },
});
```
**Update your Code**
If you're using the `context` parameter in `loader` and `action` functions, you may need to update your code:
- In Framework mode, if you're using `react-router-serve`, you should not need to make any updates. Otherwise, this only applies if you have a custom server with a `getLoadContext` function. Please see the docs on the middleware [`getLoadContext` changes](../how-to/middleware#changes-to-getloadcontextapploadcontext) and the instructions to [migrate to the new API](../how-to/middleware#migration-from-apploadcontext).
- In Data mode, add the `Future` module augmentation described in the [middleware docs](../how-to/middleware#2-typescript-augment-future-for-loaderaction-context) so `context` is typed correctly.
## `future.v8_splitRouteModules`
[MODES: framework]
<br/>
<br/>
**Background**
This feature enables splitting client-side route exports (`clientLoader`, `clientAction`, `clientMiddleware`, `HydrateFallback`) into separate chunks that can be loaded independently from the route component. This allows these exports to be fetched and executed while the component code is still downloading, improving performance for client-side data loading.
This can be set to `true` for opt-in behavior, or `"enforce"` to require all routes to be splittable (which will cause build failures for routes that cannot be split due to shared code).
👉 **Enable the Flag**
```ts filename=react-router.config.ts
export default {
  future: {
    v8_splitRouteModules: true,
  },
} satisfies Config;
```
**Update your Code**
No code changes are required. This is an optimization feature that works automatically once enabled.
## `future.v8_viteEnvironmentApi`
[MODES: framework]
<br/>
<br/>
**Background**
This enables support for the experimental Vite Environment API, which provides a more flexible and powerful way to configure Vite environments. This is only available when using Vite 6+.
👉 **Enable the Flag**
```ts filename=react-router.config.ts
export default {
  future: {
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
```
**Update your Code**
No code changes are required unless you have custom Vite configuration that needs to be updated for the [Environment API][vite-environment]. Most users won't need to make any changes.
## `future.v8_passThroughRequests`
[MODES: framework]
<br/>
<br/>
**Background**
By default, React Router normalizes the `request.url` passed to your `loader`, `action`, and `middleware` functions by removing React Router's internal implementation details. Specifically, it removes `.data` suffixes and internal search parameters like `?index` and `?_routes`.
This flag eliminates that normalization and passes the raw HTTP `request` instance to your handlers. This provides a few benefits:
- Reduces server-side overhead by eliminating multiple `new Request()` calls on the critical path
- Allows you to distinguish document from data requests in your handlers based on the presence of a `.data` suffix (useful for [observability] purposes)
If you were previously relying on the normalization of `request.url`, you can switch to use the new sibling `url` parameter which contains a `URL` instance representing the normalized location.
👉 **Enable the Flag**
```ts filename=react-router.config.ts
export default {
  future: {
    v8_passThroughRequests: true,
  },
} satisfies Config;
```
**Update your Code**
If your code relies on inspecting the request URL, you should review it for any assumptions about the URL format:
```tsx
// ❌ Before: assuming no `.data` suffix in `request.url` pathname
export async function loader({
  request,
}: Route.LoaderArgs) {
  let url = new URL(request.url);
  if (url.pathname === "/path") {
    // This check might now behave differently because the request pathname will
    // contain the `.data` suffix on data requests
  }
}
// ✅ After: use `url` for normalized routing logic and `request.url`
// for raw routing logic
export async function loader({
  request,
  url,
}: Route.LoaderArgs) {
  if (url.pathname === "/path") {
    // This will always have the `.data` suffix stripped
  }
  // And now you can distinguish between document versus data requests
  let isDataRequest = new URL(
    request.url,
  ).pathname.endsWith(".data");
}
```
## Unstable Future Flags (Optional)
We document some [unstable] flags here as a reference for folks contributing to the project via beta testing, but they are not generally recommended for production use and may having breaking changes patch/minor releases - adopt with caution!
_No current unstable flags to document_
[api-development-strategy]: ../community/api-development-strategy
[unstable]: ../community/api-development-strategy#unstable-flags
[observability]: ../how-to/instrumentation
[Response]: https://developer.mozilla.org/en-US/docs/Web/API/Response
[vite-environment]: https://vite.dev/guide/api-environment

---

## Page 203 — `docs/upgrading/index.md`

Live URL: https://reactrouter.com/upgrading/index



---

## Page 204 — `docs/upgrading/remix.md`

Live URL: https://reactrouter.com/upgrading/remix

# Upgrading from Remix
<docs-info>
React Router v7 requires the following minimum versions:
- `node@20`
- `react@18`
- `react-dom@18`
</docs-info>
React Router v7 is the next major version of Remix after v2 (see our ["Incremental Path to React 19" blog post][incremental-path-to-react-19] for more information).
If you have enabled all [Remix v2 future flags][v2-future-flags], upgrading from Remix v2 to React Router v7 mainly involves updating dependencies.
<docs-info>
The majority of steps 2-8 can be automatically updated using a [codemod][codemod] created by community member [James Restall][jrestall].
</docs-info>
## 1. Adopt future flags
**👉 Adopt future flags**
Adopt all existing [future flags][v2-future-flags] in your Remix v2 application.
## 2. Update dependencies
Most of the "shared" APIs that used to be re-exported through the runtime-specific packages (`@remix-run/node`, `@remix-run/cloudflare`, etc.) have all been collapsed into `react-router` in v7. So instead of importing from `@react-router/node` or `@react-router/cloudflare`, you'll import those directly from `react-router`.
```diff
-import { redirect } from "@remix-run/node";
+import { redirect } from "react-router";
```
The only APIs you should be importing from the runtime-specific packages in v7 are APIs that are specific to that runtime, such as `createFileSessionStorage` for Node and `createWorkersKVSessionStorage` for Cloudflare.
**👉 Run the codemod (automated)**
You can automatically update your packages and imports with the following [codemod][codemod]. This codemod updates all of your packages and imports. Be sure to commit any pending changes before running the codemod, in case you need to revert.
```shellscript nonumber
npx codemod remix/2/react-router/upgrade
```
**👉 Install the new dependencies**
After the codemod updates your dependencies, you need to install the dependencies to remove Remix packages and add the new React Router packages.
```shellscript nonumber
npm install
```
**👉 Update your dependencies (manual)**
If you prefer not to use the codemod, you can manually update your dependencies.
<details>
<summary>Expand to see a table of package name changes in alphabetical order</summary>
| Remix v2 Package                   |     | React Router v7 Package                     |
| ---------------------------------- | --- | ------------------------------------------- |
| `@remix-run/architect`             | ➡️  | `@react-router/architect`                   |
| `@remix-run/cloudflare`            | ➡️  | `@react-router/cloudflare`                  |
| `@remix-run/dev`                   | ➡️  | `@react-router/dev`                         |
| `@remix-run/express`               | ➡️  | `@react-router/express`                     |
| `@remix-run/fs-routes`             | ➡️  | `@react-router/fs-routes`                   |
| `@remix-run/node`                  | ➡️  | `@react-router/node`                        |
| `@remix-run/react`                 | ➡️  | `react-router`                              |
| `@remix-run/route-config`          | ➡️  | `@react-router/dev`                         |
| `@remix-run/routes-option-adapter` | ➡️  | `@react-router/remix-routes-option-adapter` |
| `@remix-run/serve`                 | ➡️  | `@react-router/serve`                       |
| `@remix-run/server-runtime`        | ➡️  | `react-router`                              |
| `@remix-run/testing`               | ➡️  | `react-router`                              |
</details>
## 3. Change `scripts` in `package.json`
<docs-info>
If you used the codemod you can skip this step as it was automatically completed.
</docs-info>
**👉 Update the scripts in your `package.json`**
| Script      | Remix v2                            |     | React Router v7                            |
| ----------- | ----------------------------------- | --- | ------------------------------------------ |
| `dev`       | `remix vite:dev`                    | ➡️  | `react-router dev`                         |
| `build`     | `remix vite:build`                  | ➡️  | `react-router build`                       |
| `start`     | `remix-serve build/server/index.js` | ➡️  | `react-router-serve build/server/index.js` |
| `typecheck` | `tsc`                               | ➡️  | `react-router typegen && tsc`              |
## 4. Add a `routes.ts` file
<docs-info>
If you used the codemod _and_ Remix v2 `v3_routeConfig` flag, you can skip this step as it was automatically completed.
</docs-info>
In React Router v7 you define your routes using the `app/routes.ts` file. View the [routing documentation][routing] for more information.
**👉 Update dependencies (if using Remix v2 `v3_routeConfig` flag)**
```diff filename=app/routes.ts
-import { type RouteConfig } from "@remix-run/route-config";
-import { flatRoutes } from "@remix-run/fs-routes";
-import { remixRoutesOptionAdapter } from "@remix-run/routes-option-adapter";
+import { type RouteConfig } from "@react-router/dev/routes";
+import { flatRoutes } from "@react-router/fs-routes";
+import { remixRoutesOptionAdapter } from "@react-router/remix-routes-option-adapter";
export default [
  // however your routes are defined
] satisfies RouteConfig;
```
**👉 Add a `routes.ts` file (if _not_ using Remix v2 `v3_routeConfig` flag)**
```shellscript nonumber
touch app/routes.ts
```
For backwards-compatibility, there are a few ways to adopt `routes.ts` to align with your route setup in Remix v2:
1. If you were using the "flat routes" [file-based convention][fs-routing], you can continue to use that via the new `@react-router/fs-routes` package:
   ```ts filename=app/routes.ts
   import { type RouteConfig } from "@react-router/dev/routes";
   import { flatRoutes } from "@react-router/fs-routes";
   export default flatRoutes() satisfies RouteConfig;
   ```
2. If you were using the "nested" convention from Remix v1 via the `@remix-run/v1-route-convention` package, you can continue using that as well in conjunction with `@react-router/remix-routes-option-adapter`:
   ```ts filename=app/routes.ts
   import { type RouteConfig } from "@react-router/dev/routes";
   import { remixRoutesOptionAdapter } from "@react-router/remix-routes-option-adapter";
   import { createRoutesFromFolders } from "@remix-run/v1-route-convention";
   export default remixRoutesOptionAdapter(
     createRoutesFromFolders,
   ) satisfies RouteConfig;
   ```
3. If you were using the `routes` option to define config-based routes, you can keep that config via `@react-router/remix-routes-option-adapter`:
   ```ts filename=app/routes.ts
   import { type RouteConfig } from "@react-router/dev/routes";
   import { remixRoutesOptionAdapter } from "@react-router/remix-routes-option-adapter";
   export default remixRoutesOptionAdapter(
     (defineRoutes) => {
       return defineRoutes((route) => {
         route("/", "home/route.tsx", { index: true });
         route("about", "about/route.tsx");
         route("", "concerts/layout.tsx", () => {
           route("trending", "concerts/trending.tsx");
           route(":city", "concerts/city.tsx");
         });
       });
     },
   ) satisfies RouteConfig;
   ```
   - Be sure to also remove the `routes` option in your `vite.config.ts`:
     ```diff filename=vite.config.ts
     export default defineConfig({
       plugins: [
         remix({
           ssr: true,
     -     ignoredRouteFiles: ['**/*'],
     -     routes(defineRoutes) {
     -       return defineRoutes((route) => {
     -         route("/somewhere/cool/*", "catchall.tsx");
     -       });
     -     },
         })
         tsconfigPaths(),
       ],
     });
     ```
## 5. Add a React Router config
**👉 Add `react-router.config.ts` your project**
The config that was previously passed to the `remix` plugin in `vite.config.ts` is now exported from `react-router.config.ts`.
Note: At this point you should remove the v3 future flags you added in step 1.
```shellscript nonumber
touch react-router.config.ts
```
```diff filename=vite.config.ts
export default defineConfig({
  plugins: [
-   remix({
-     ssr: true,
-     future: {/* all the v3 flags */}
-   }),
+   reactRouter(),
    tsconfigPaths(),
  ],
});
```
```diff filename=react-router.config.ts
+import type { Config } from "@react-router/dev/config";
+export default {
+  ssr: true,
+} satisfies Config;
```
## 6. Add React Router plugin to `vite.config`
<docs-info>
If you used the codemod you can skip this step as it was automatically completed.
</docs-info>
**👉 Add `reactRouter` plugin to `vite.config`**
Change `vite.config.ts` to import and use the new `reactRouter` plugin from `@react-router/dev/vite`:
```diff filename=vite.config.ts
-import { vitePlugin as remix } from "@remix-run/dev";
+import { reactRouter } from "@react-router/dev/vite";
export default defineConfig({
  plugins: [
-   remix(),
+   reactRouter(),
    tsconfigPaths(),
  ],
});
```
## 7. Enable type safety
<docs-info>
If you are not using TypeScript, you can skip this step.
</docs-info>
React Router automatically generates types for your route modules into a `.react-router/` directory at the root of your app. This directory is fully managed by React Router and should be gitignore'd. Learn more about the [new type safety features][type-safety].
**👉 Add `.react-router/` to `.gitignore`**
```txt
.react-router/
```
**👉 Update `tsconfig.json`**
Update the `types` field in your `tsconfig.json` to include:
- `.react-router/types/**/*` path in the `include` field
- The appropriate `@react-router/*` package in the `types` field
- `rootDirs` for simplified relative imports
```diff filename=tsconfig.json
{
  "include": [
    /* ... */
+   ".react-router/types/**/*"
  ],
  "compilerOptions": {
-   "types": ["@remix-run/node", "vite/client"],
+   "types": ["@react-router/node", "vite/client"],
    /* ... */
+   "rootDirs": [".", "./.react-router/types"]
  }
}
```
## 8. Rename components in entry files
<docs-info>
If you used the codemod you can skip this step as it was automatically completed.
</docs-info>
If you have an `entry.server.tsx` and/or an `entry.client.tsx` file in your application, you will need to update the main components in these files:
```diff filename=app/entry.server.tsx
-import { RemixServer } from "@remix-run/react";
+import { ServerRouter } from "react-router";
-<RemixServer context={remixContext} url={request.url} />,
+<ServerRouter context={remixContext} url={request.url} />,
```
```diff filename=app/entry.client.tsx
-import { RemixBrowser } from "@remix-run/react";
+import { HydratedRouter } from "react-router/dom";
hydrateRoot(
  document,
  <StrictMode>
-   <RemixBrowser />
+   <HydratedRouter />
  </StrictMode>,
);
```
## 9. Update types for `AppLoadContext`
<docs-info>
If you were using `remix-serve` you can skip this step. This is only applicable if you were using a custom server in Remix v2.
</docs-info>
Since React Router can be used as both a React framework _and_ a stand-alone routing library, the `context` argument for `LoaderFunctionArgs` and `ActionFunctionArgs` is now optional and typed as `any` by default. You can register types for your load context to get type safety for your loaders and actions.
👉 **Register types for your load context**
Before you migrate to the new `Route.LoaderArgs` and `Route.ActionArgs` types, you can temporarily augment `LoaderFunctionArgs` and `ActionFunctionArgs` with your load context type to ease migration.
```ts filename=app/env.ts
declare module "react-router" {
  // Your AppLoadContext used in v2
  interface AppLoadContext {
    whatever: string;
  }
  // TODO: remove this once we've migrated to `Route.LoaderArgs` instead for our loaders
  interface LoaderFunctionArgs {
    context: AppLoadContext;
  }
  // TODO: remove this once we've migrated to `Route.ActionArgs` instead for our actions
  interface ActionFunctionArgs {
    context: AppLoadContext;
  }
}
export {}; // necessary for TS to treat this as a module
```
<docs-info>
Using `declare module` to register types is a standard TypeScript technique called [module augmentation][ts-module-augmentation].
You can do this in any TypeScript file covered by your `tsconfig.json`'s `include` field, but we recommend a dedicated `env.ts` within your app directory.
</docs-info>
👉 **Use the new types**
Once you adopt the [new type generation][type-safety], you can remove the `LoaderFunctionArgs`/`ActionFunctionArgs` augmentations and use the `context` argument from [`Route.LoaderArgs`][server-loaders] and [`Route.ActionArgs`][server-actions] instead.
```ts filename=app/env.ts
declare module "react-router" {
  // Your AppLoadContext used in v2
  interface AppLoadContext {
    whatever: string;
  }
}
export {}; // necessary for TS to treat this as a module
```
```ts filename=app/routes/my-route.tsx
export function loader({ context }: Route.LoaderArgs) {}
// { whatever: string }  ^^^^^^^
export function action({ context }: Route.ActionArgs) {}
// { whatever: string }  ^^^^^^^
```
Congratulations! You are now on React Router v7. Go ahead and run your application to make sure everything is working as expected.
[incremental-path-to-react-19]: https://remix.run/blog/incremental-path-to-react-19
[v2-future-flags]: https://remix.run/docs/start/future-flags
[routing]: ../start/framework/routing
[fs-routing]: ../how-to/file-route-conventions
[v7-changelog-types]: https://github.com/remix-run/react-router/blob/release-next/CHANGELOG.md#type-safety-improvements
[server-loaders]: ../start/framework/data-loading#server-data-loading
[server-actions]: ../start/framework/actions#server-actions
[ts-module-augmentation]: https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
[type-safety]: ../explanation/type-safety
[codemod]: https://app.codemod.com/registry/remix/2/react-router/upgrade
[jrestall]: https://github.com/jrestall

---

## Page 205 — `docs/upgrading/router-provider.md`

Live URL: https://reactrouter.com/upgrading/router-provider

# Framework Adoption from RouterProvider
If you are not using `<RouterProvider>` please see [Framework Adoption from Component Routes][upgrade-component-routes] instead.
The React Router Vite plugin adds framework features to React Router. This guide will help you adopt the plugin in your app. If you run into any issues, please reach out for help on [Twitter](https://x.com/remix_run) or [Discord](https://rmx.as/discord).
## Features
The Vite plugin adds:
- Route loaders, actions, and automatic data revalidation
- Type-safe Routes Modules
- Automatic route code-splitting
- Automatic scroll restoration across navigations
- Optional Static pre-rendering
- Optional Server rendering
The initial setup requires the most work. However, once complete, you can adopt new features incrementally.
## Prerequisites
To use the Vite plugin, your project requires:
- Node.js 20+ (if using Node as your runtime)
- Vite 5+
## 1. Move route definitions into route modules
The React Router Vite plugin renders its own `RouterProvider`, so you can't render an existing `RouterProvider` within it. Instead, you will need to format all of your route definitions to match the [Route Module API][route-modules].
This step will take the longest, however there are several benefits to doing this regardless of adopting the React Router Vite plugin:
- Route modules will be lazy loaded, decreasing the initial bundle size of your app
- Route definitions will be uniform, simplifying your app's architecture
- Moving to route modules is incremental, you can migrate one route at a time
**👉 Move your route definitions into route modules**
Export each piece of your route definition as a separate named export, following the [Route Module API][route-modules].
```tsx filename=src/routes/about.tsx
export async function clientLoader() {
  return {
    title: "About",
  };
}
export default function About() {
  let data = useLoaderData();
  return <div>{data.title}</div>;
}
// clientAction, ErrorBoundary, etc.
```
**👉 Create a convert function**
Create a helper function to convert route module definitions into the format expected by your data router:
```tsx filename=src/main.tsx
function convert(m: any) {
  let {
    clientLoader,
    clientAction,
    default: Component,
    ...rest
  } = m;
  return {
    ...rest,
    loader: clientLoader,
    action: clientAction,
    Component,
  };
}
```
**👉 Lazy load and convert your route modules**
Instead of importing your route modules directly, lazy load and convert them to the format expected by your data router.
Not only does your route definition now conform to the Route Module API, but you also get the benefits of code-splitting your routes.
```diff filename=src/main.tsx
let router = createBrowserRouter([
  // ... other routes
  {
    path: "about",
-   loader: aboutLoader,
-   Component: About,
+   lazy: () => import("./routes/about").then(convert),
  },
  // ... other routes
]);
```
Repeat this process for each route in your app.
## 2. Install the Vite plugin
Once all of your route definitions are converted to route modules, you can adopt the React Router Vite plugin.
**👉 Install the React Router Vite plugin**
```shellscript nonumber
npm install -D @react-router/dev
```
**👉 Install a runtime adapter**
We will assume you are using Node as your runtime.
```shellscript nonumber
npm install @react-router/node
```
**👉 Swap out the React plugin for React Router**
```diff filename=vite.config.ts
-import react from '@vitejs/plugin-react'
+import { reactRouter } from "@react-router/dev/vite";
export default defineConfig({
  plugins: [
-    react()
+    reactRouter()
  ],
});
```
## 3. Add the React Router config
**👉 Create a `react-router.config.ts` file**
Add the following to the root of your project. In this config you can tell React Router about your project, like where to find the app directory and to not use SSR (server-side rendering) for now.
```shellscript nonumber
touch react-router.config.ts
```
```ts filename=react-router.config.ts
export default {
  appDirectory: "src",
  ssr: false,
} satisfies Config;
```
## 4. Add the Root entry point
In a typical Vite app, the `index.html` file is the entry point for bundling. The React Router Vite plugin moves the entry point to a `root.tsx` file so you can use React to render the shell of your app instead of static HTML, and eventually upgrade to Server Rendering if you want.
**👉 Move your existing `index.html` to `root.tsx`**
For example, if your current `index.html` looks like this:
```html filename=index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
You would move that markup into `src/root.tsx` and delete `index.html`:
```shellscript nonumber
touch src/root.tsx
```
```tsx filename=src/root.tsx
export function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>My App</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
export default function Root() {
  return <Outlet />;
}
```
**👉 Move everything above `RouterProvider` to `root.tsx`**
Any global styles, context providers, etc. should be moved into `root.tsx` so they can be shared across all routes.
For example, if your `App.tsx` looks like this:
```tsx filename=src/App.tsx
export default function App() {
  return (
    <OtherProviders>
      <AppLayout>
        <RouterProvider router={router} />
      </AppLayout>
    </OtherProviders>
  );
}
```
You would move everything above the `RouterProvider` into `root.tsx`.
```diff filename=src/root.tsx
+import "./index.css";
// ... other imports and Layout
export default function Root() {
  return (
+   <OtherProviders>
+     <AppLayout>
        <Outlet />
+     </AppLayout>
+   </OtherProviders>
  );
}
```
## 5. Add client entry module (optional)
In the typical Vite app the `index.html` file points to `src/main.tsx` as the client entry point. React Router uses a file named `src/entry.client.tsx` instead.
If no `entry.client.tsx` exists, the React Router Vite plugin will use a default, hidden one.
**👉 Make `src/entry.client.tsx` your entry point**
If your current `src/main.tsx` looks like this:
```tsx filename=src/main.tsx
const router = createBrowserRouter([
  // ... route definitions
]);
ReactDOM.createRoot(
  document.getElementById("root")!,
).render(
  <React.StrictMode>
    <RouterProvider router={router} />;
  </React.StrictMode>,
);
```
You would rename it to `entry.client.tsx` and change it to this:
```tsx filename=src/entry.client.tsx
ReactDOM.hydrateRoot(
  document,
  <React.StrictMode>
    <HydratedRouter />
  </React.StrictMode>,
);
```
- Use `hydrateRoot` instead of `createRoot`
- Render a `<HydratedRouter>` instead of your `<App/>` component
- Note: We are no longer creating the routes and manually passing them to `<RouterProvider />`. We will migrate our route definitions in the next step.
## 6. Migrate your routes
The React Router Vite plugin uses a `routes.ts` file to configure your routes. The format will be pretty similar to the definitions of your data router.
**👉 Move definitions to a `routes.ts` file**
```shellscript nonumber
touch src/routes.ts src/catchall.tsx
```
Move your route definitions to `routes.ts`. Note that the schemas don't match exactly, so you will get type errors; we'll fix this next.
```diff filename=src/routes.ts
+import type { RouteConfig } from "@react-router/dev/routes";
-const router = createBrowserRouter([
+export default [
  {
    path: "/",
    lazy: () => import("./routes/layout").then(convert),
    children: [
      {
        index: true,
        lazy: () => import("./routes/home").then(convert),
      },
      {
        path: "about",
        lazy: () => import("./routes/about").then(convert),
      },
      {
        path: "todos",
        lazy: () => import("./routes/todos").then(convert),
        children: [
          {
            path: ":id",
            lazy: () =>
              import("./routes/todo").then(convert),
          },
        ],
      },
    ],
  },
-]);
+] satisfies RouteConfig;
```
**👉 Replace the `lazy` loader with a `file` loader**
```diff filename=src/routes.ts
export default [
  {
    path: "/",
-   lazy: () => import("./routes/layout").then(convert),
+   file: "./routes/layout.tsx",
    children: [
      {
        index: true,
-       lazy: () => import("./routes/home").then(convert),
+       file: "./routes/home.tsx",
      },
      {
        path: "about",
-       lazy: () => import("./routes/about").then(convert),
+       file: "./routes/about.tsx",
      },
      {
        path: "todos",
-       lazy: () => import("./routes/todos").then(convert),
+       file: "./routes/todos.tsx",
        children: [
          {
            path: ":id",
-           lazy: () => import("./routes/todo").then(convert),
+           file: "./routes/todo.tsx",
          },
        ],
      },
    ],
  },
] satisfies RouteConfig;
```
[View our guide on configuring routes][configuring-routes] to learn more about the `routes.ts` file and helper functions to further simplify the route definitions.
## 7. Boot the app
At this point you should be fully migrated to the React Router Vite plugin. Go ahead and update your `dev` script and run the app to make sure everything is working.
**👉 Add `dev` script and run the app**
```json filename=package.json
"scripts": {
  "dev": "react-router dev"
}
```
Now make sure you can boot your app at this point before moving on:
```shellscript
npm run dev
```
You will probably want to add `.react-router/` to your `.gitignore` file to avoid tracking unnecessary files in your repository.
```txt
.react-router/
```
You can checkout [Type Safety][type-safety] to learn how to fully setup and use autogenerated type safety for params, loader data, and more.
## Enable SSR and/or Pre-rendering
If you want to enable server rendering and static pre-rendering, you can do so with the `ssr` and `prerender` options in the bundler plugin. For SSR you'll need to also deploy the server build to a server.
```ts filename=react-router.config.ts
export default {
  ssr: true,
  async prerender() {
    return ["/", "/about", "/contact"];
  },
} satisfies Config;
```
[upgrade-component-routes]: ./component-routes
[configuring-routes]: ../start/framework/routing
[route-modules]: ../start/framework/route-module
[type-safety]: ../how-to/route-module-type-safety

---

## Page 206 — `docs/upgrading/v6.md`

Live URL: https://reactrouter.com/upgrading/v6

# Upgrading from v6
<docs-info>
React Router v7 requires the following minimum versions:
- `node@20`
- `react@18`
- `react-dom@18`
</docs-info>
The v7 upgrade has no breaking changes if you have enabled all future flags. These flags allow you to update your app one change at a time. We highly recommend you make a commit after each step and ship it instead of doing everything all at once.
## Update to latest v6.x
First update to the latest minor version of v6.x to have the latest future flags and console warnings.
👉 **Update to latest v6**
```shellscript nonumber
npm install react-router-dom@6
```
### v7_relativeSplatPath
**Background**
Changes the relative path matching and linking for multi-segment splats paths like `dashboard/*` (vs. just `*`). [View the CHANGELOG](https://github.com/remix-run/react-router/blob/main/CHANGELOG.md#futurev7_relativesplatpath) for more information.
👉 **Enable the flag**
Enabling the flag depends on the type of router:
```tsx
<BrowserRouter
  future={{
    v7_relativeSplatPath: true,
  }}
/>
```
```tsx
createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
  },
});
```
**Update your Code**
If you have any routes with a path + a splat like `<Route path="dashboard/*">` that have relative links like `<Link to="relative">` or `<Link to="../relative">` beneath them, you will need to update your code.
👉 **Split the `<Route>` into two**
Split any multi-segment splat `<Route>` into a parent route with the path and a child route with the splat:
```diff
<Routes>
  <Route path="/" element={<Home />} />
-  <Route path="dashboard/*" element={<Dashboard />} />
+  <Route path="dashboard">
+    <Route path="*" element={<Dashboard />} />
+  </Route>
</Routes>
// or
createBrowserRouter([
  { path: "/", element: <Home /> },
  {
-    path: "dashboard/*",
-    element: <Dashboard />,
+    path: "dashboard",
+    children: [{ path: "*", element: <Dashboard /> }],
  },
]);
```
👉 **Update relative links**
Update any `<Link>` elements within that route tree to include the extra `..` relative segment to continue linking to the same place:
```diff
function Dashboard() {
  return (
    <div>
      <h2>Dashboard</h2>
      <nav>
         <Link to="/">Dashboard Home</Link>
-        <Link to="team">Team</Link>
-        <Link to="projects">Projects</Link>
+        <Link to="../team">Team</Link>
+        <Link to="../projects">Projects</Link>
      </nav>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="team" element={<DashboardTeam />} />
        <Route
          path="projects"
          element={<DashboardProjects />}
        />
      </Routes>
    </div>
  );
}
```
### v7_startTransition
**Background**
This uses `React.useTransition` instead of `React.useState` for Router state updates. View the [CHANGELOG](https://github.com/remix-run/react-router/blob/main/CHANGELOG.md#futurev7_starttransition) for more information.
👉 **Enable the flag**
```tsx
<BrowserRouter
  future={{
    v7_startTransition: true,
  }}
/>
// or
<RouterProvider
  future={{
    v7_startTransition: true,
  }}
/>
```
👉 **Update your Code**
You don't need to update anything unless you are using `React.lazy` _inside_ of a component.
Using `React.lazy` inside of a component is incompatible with `React.useTransition` (or other code that makes promises inside of components). Move `React.lazy` to the module scope and stop making promises inside of components. This is not a limitation of React Router but rather incorrect usage of React.
### v7_fetcherPersist
<docs-warning>If you are not using a `<RouterProvider>` you can skip this</docs-warning>
**Background**
The fetcher lifecycle is now based on when it returns to an idle state rather than when its owner component unmounts: [View the CHANGELOG](https://github.com/remix-run/react-router/blob/main/CHANGELOG.md#persistence-future-flag-futurev7_fetcherpersist) for more information.
**Enable the Flag**
```tsx
createBrowserRouter(routes, {
  future: {
    v7_fetcherPersist: true,
  },
});
```
**Update your Code**
It's unlikely to affect your app. You may want to check any usage of `useFetchers` as they may persist longer than they did before. Depending on what you're doing, you may render something longer than before.
### v7_normalizeFormMethod
<docs-warning>If you are not using a `<RouterProvider>` you can skip this</docs-warning>
This normalizes `formMethod` fields as uppercase HTTP methods to align with the `fetch()` behavior. [View the CHANGELOG](https://github.com/remix-run/react-router/blob/main/CHANGELOG.md#futurev7_normalizeformmethod) for more information.
👉 **Enable the Flag**
```tsx
createBrowserRouter(routes, {
  future: {
    v7_normalizeFormMethod: true,
  },
});
```
**Update your Code**
If any of your code is checking for lowercase HTTP methods, you will need to update it to check for uppercase HTTP methods (or call `toLowerCase()` on it).
👉 **Compare `formMethod` to UPPERCASE**
```diff
-useNavigation().formMethod === "post"
-useFetcher().formMethod === "get";
+useNavigation().formMethod === "POST"
+useFetcher().formMethod === "GET";
```
### v7_partialHydration
<docs-warning>If you are not using a `<RouterProvider>` you can skip this</docs-warning>
This enables partial hydration of a data router which is primarily used for SSR frameworks, but it is also useful if you are using `lazy` to load your route modules. It's unlikely you need to worry about this, just turn the flag on. [View the CHANGELOG](https://github.com/remix-run/react-router/blob/main/CHANGELOG.md#partial-hydration) for more information.
👉 **Enable the Flag**
```tsx
createBrowserRouter(routes, {
  future: {
    v7_partialHydration: true,
  },
});
```
**Update your Code**
With partial hydration, you need to provide a `HydrateFallback` component to render during initial hydration. Additionally, if you were using `fallbackElement` before, you need to remove it as it is now deprecated. In most cases, you will want to reuse the `fallbackElement` as the `HydrateFallback`.
👉 **Replace `fallbackElement` with `HydrateFallback`**
```diff
const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: Layout,
+      HydrateFallback: Fallback,
      // or
+      hydrateFallbackElement: <Fallback />,
      children: [],
    },
  ],
);
<RouterProvider
  router={router}
-  fallbackElement={<Fallback />}
/>
```
### v7_skipActionErrorRevalidation
<docs-warning>If you are not using a `createBrowserRouter` you can skip this</docs-warning>
When this flag is enabled, loaders will no longer revalidate by default after an action throws/returns a `Response` with a `4xx`/`5xx` status code. You may opt-into revalidation in these scenarios via `shouldRevalidate` and the `actionStatus` parameter.
👉 **Enable the Flag**
```tsx
createBrowserRouter(routes, {
  future: {
    v7_skipActionErrorRevalidation: true,
  },
});
```
**Update your Code**
In most cases, you probably won't have to make changes to your app code. Usually, if an action errors, it's unlikely data was mutated and needs revalidation. If any of your code _does_ mutate data in action error scenarios you have 2 options:
👉 **Option 1: Change the `action` to avoid mutations in error scenarios**
```js
// Before
async function action() {
  await mutateSomeData();
  if (detectError()) {
    throw new Response(error, { status: 400 });
  }
  await mutateOtherData();
  // ...
}
// After
async function action() {
  if (detectError()) {
    throw new Response(error, { status: 400 });
  }
  // All data is now mutated after validations
  await mutateSomeData();
  await mutateOtherData();
  // ...
}
```
👉 **Option 2: Opt-into revalidation via `shouldRevalidate` and `actionStatus`**
```js
async function action() {
  await mutateSomeData();
  if (detectError()) {
    throw new Response(error, { status: 400 });
  }
  await mutateOtherData();
}
async function loader() { ... }
function shouldRevalidate({ actionStatus, defaultShouldRevalidate }) {
  if (actionStatus != null && actionStatus >= 400) {
    // Revalidate this loader when actions return a 4xx/5xx status
    return true;
  }
  return defaultShouldRevalidate;
}
```
## Deprecations
The `json` and `defer` methods are deprecated in favor of returning raw objects.
```diff
async function loader() {
- return json({ data });
+ return { data };
```
If you were using `json` to serialize your data to JSON, you can use the native [Response.json()][response-json] method instead.
## Upgrade to v7
Now that your app is caught up, you can simply update to v7 (theoretically!) without issue.
👉 **Install v7**
```shellscript nonumber
npm install react-router-dom@latest
```
👉 **Replace react-router-dom with react-router**
In v7 we no longer need `"react-router-dom"` as the packages have been simplified. You can import everything from `"react-router"`:
```shellscript nonumber
npm uninstall react-router-dom
npm install react-router@latest
```
Note you only need `"react-router"` in your package.json.
👉 **Update imports**
Now you should update your imports to use `react-router`:
```diff
-import { useLocation } from "react-router-dom";
+import { useLocation } from "react-router";
```
Instead of manually updating imports, you can use this command. Make sure your git working tree is clean though so you can revert if it doesn't work as expected.
```shellscript nonumber
find ./path/to/src \( -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" \) -type f -exec sed -i '' 's|from "react-router-dom"|from "react-router"|g' {} +
```
If you have GNU `sed` installed (most Linux distributions), use this command instead:
```shellscript nonumber
find ./path/to/src \( -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" \) -type f -exec sed -i 's|from "react-router-dom"|from "react-router"|g' {} +
```
👉 **Update DOM-specific imports**
`RouterProvider` and `HydratedRouter` come from a deep import because they depend on `"react-dom"`:
```diff
-import { RouterProvider } from "react-router-dom";
+import { RouterProvider } from "react-router/dom";
```
Note you should use a top-level import for non-DOM contexts, such as Jest tests:
```diff
-import { RouterProvider } from "react-router-dom";
+import { RouterProvider } from "react-router";
```
Congratulations, you're now on v7!
[react-flushsync]: https://react.dev/reference/react-dom/flushSync
[response-json]: https://developer.mozilla.org/en-US/docs/Web/API/Response/json
[data-util]: https://api.reactrouter.com/v7/functions/react-router.data.html