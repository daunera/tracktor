<script lang="ts">
  import VehicleSharing from '$feature/vehicle/VehicleSharing.svelte';
  import VehicleShareForm from '$feature/vehicle/VehicleShareForm.svelte';
  import { vehicleStore } from '$stores/vehicle.svelte';
  import { authStore } from '$stores/auth.svelte';
  import { sheetStore } from '$stores/sheet.svelte';
  import * as m from '$lib/paraglide/messages';
  import Users from '@lucide/svelte/icons/users';
  import CirclePlus from '@lucide/svelte/icons/circle-plus';
  import Button from '$ui/button/button.svelte';
  import LabelWithIcon from '$appui/LabelWithIcon.svelte';

  let selectedId = $derived(vehicleStore.selectedId);
  let selectedVehicle = $derived(vehicleStore.vehicles?.find((v) => v.id === selectedId) || null);
  let isOwner = $derived(
    selectedVehicle?.userId != null &&
      authStore.user?.id != null &&
      selectedVehicle.userId === authStore.user.id
  );
</script>

{#if !selectedId}
  <div
    class="bg-muted text-muted-foreground border-border flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed text-center"
  >
    <Users class="mb-2 h-8 w-8" />
    <p class="text-lg font-medium">{m.app_empty_select_message()}</p>
    <p class="text-sm">{m.app_empty_select_hint()}</p>
  </div>
{:else if !isOwner}
  <div
    class="bg-muted text-muted-foreground border-border flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed text-center"
  >
    <p class="text-lg font-medium">{m.nav_sharing()}</p>
    <p class="text-sm">Only the vehicle owner can manage sharing.</p>
  </div>
{:else}
  <div class="tab-container lg:bg-secondary rounded-md p-2 lg:p-4" role="tabpanel">
    <div id="tab-container-header" class="flex flex-row justify-between">
      <h2 id="tab-container-title" class="mb-6 font-bold underline underline-offset-8 lg:text-2xl">
        {m.nav_sharing()}
      </h2>
      <div class="flex flex-row items-center">
        <Button
          size="sm"
          variant="outline"
          class="cursor-pointer"
          onclick={() => sheetStore.openSheet(VehicleShareForm, m.share_add_sheet_title())}
        >
          <LabelWithIcon icon={CirclePlus} label={m.common_add_new()} />
        </Button>
      </div>
    </div>
    <VehicleSharing />
  </div>
{/if}
