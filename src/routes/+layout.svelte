<script lang="ts">
  import type { LayoutProps } from './$types';
  import { locales, localizeHref, getLocale } from '$lib/paraglide/runtime';
  import { ModeWatcher } from 'mode-watcher';
  import '../styles/app.css';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import Skeleton from '$lib/components/ui/skeleton/skeleton.svelte';
  import { Toaster } from '$ui/sonner';
  import LabelWithIcon from '$appui/LabelWithIcon.svelte';
  import { navigating, page } from '$app/state';
  import { goto } from '$app/navigation';
  import Header from '$layout/Header.svelte';
  import AppSheet from '$layout/AppSheet.svelte';
  import { onMount } from 'svelte';
  import { env } from '$lib/config/env';
  import { toast } from 'svelte-sonner';
  import { configStore } from '$lib/stores/config.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import {
    demo_banner,
    default_login,
    app_name,
    og_title,
    og_description
  } from '$lib/paraglide/messages/_index.js';
  import { app_new_update_available } from '$lib/paraglide/messages';

  let { children, data }: LayoutProps = $props();
  let demoMode = env.DEMO_MODE;
  let customCss = $state('');
  let isDashboardTransition = $derived(
    navigating.to &&
      navigating.to.url.pathname.startsWith('/dashboard') &&
      navigating.from?.url.pathname.startsWith('/dashboard')
  );
  let showGlobalLoader = $derived(
    navigating.to && !navigating.to.route.id?.includes('(auth)') && !isDashboardTransition
  );
  const ogImageUrl = $derived(`${data.baseUrl}/og/og-image-${getLocale()}.jpg`);

  async function detectSWUpdate() {
    const registrations = await navigator?.serviceWorker?.ready;

    registrations?.addEventListener('updatefound', () => {
      const newSW = registrations.installing;

      newSW?.addEventListener('statechange', () => {
        if (newSW.state === 'installed') {
          toast.info(app_new_update_available());

          setTimeout(() => {
            newSW.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }, 2000);
        }
      });
    });
  }

  onMount(() => {
    // Initialize theme
    themeStore.initializeTheme();

    detectSWUpdate();

    // Detect blocked users on every page load
    authStore.checkAuthStatus().then(() => {
      if (authStore.blockedReason) {
        authStore.blockedReason = null;
        goto('/login');
      }
    });

    configStore.getCustomCss().then((css) => {
      customCss = css;

      if (customCss) {
        const style = document.createElement('style');

        style.innerHTML = customCss;
        document.head.appendChild(style);
      }
    });
  });
</script>

<svelte:head>
  <title>{app_name()}</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta property="og:title" content={og_title()} />
  <meta property="og:description" content={og_description()} />
  <meta property="og:image" content={ogImageUrl} />
  <meta property="og:url" content={`${data.baseUrl}${page.url.pathname}`} />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={og_title()} />
  <meta name="twitter:description" content={og_description()} />
  <meta name="twitter:image" content={ogImageUrl} />
</svelte:head>

<ModeWatcher defaultMode="system" />
<Toaster position="bottom-right" richColors expand />

{#if demoMode}
  <div
    id="demo-mode-banner"
    class="demo-mode-banner bg-secondary/95 flex flex-col justify-center p-2 lg:flex-row dark:border-b-amber-900"
  >
    <LabelWithIcon
      icon={TriangleAlert}
      iconClass="h-5 w-5"
      style="text-amber-500 dark:text-amber-700 gap-1 flex-col lg:flex-row text-center lg:text-sm text-xs"
    >
      {demo_banner()}

      {#if !env.DISABLE_AUTH}
        <strong>{default_login()}</strong>
      {/if}
    </LabelWithIcon>
  </div>
{/if}

{#if showGlobalLoader}
  <div id="global-loading-layout" class="flex min-h-svh w-full flex-col">
    <header
      id="global-loading-header"
      class="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur"
    >
      <div
        id="global-loading-header-content"
        class="container flex h-14 max-w-screen-2xl items-center"
      >
        <Skeleton class="h-8 w-8 rounded-full" />
        <div id="global-loading-header-title" class="ml-4 flex items-center space-x-2">
          <Skeleton class="h-6 w-24" />
        </div>
        <div
          id="global-loading-header-actions"
          class="flex flex-1 items-center justify-end space-x-2"
        >
          <Skeleton class="h-8 w-8 rounded-full" />
        </div>
      </div>
    </header>
    <main id="global-loading-content" class="flex-1 space-y-4 p-8 pt-6">
      <div id="global-loading-title-section" class="flex items-center justify-between space-y-2">
        <Skeleton class="h-8 w-48" />
      </div>
      <div id="global-loading-body" class="space-y-4">
        <Skeleton class="h-32 w-full rounded-xl" />
        <Skeleton class="h-32 w-full rounded-xl" />
      </div>
    </main>
  </div>
{:else}
  <div id="app-container" class="flex min-h-svh w-full flex-col">
    <Header appVersion={data.appVersion} />
    <main class="flex-1">{@render children()}</main>
  </div>
{/if}
<AppSheet />
<div style="display:none">
  {#each locales as locale (locale)}
    <a href={localizeHref(page.url.pathname, { locale })}>
      {locale}
    </a>
  {/each}
</div>
