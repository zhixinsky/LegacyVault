<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }>(),
  {
    variant: 'primary',
    disabled: false,
    type: 'button',
  },
);
</script>

<template>
  <button
    :type="type"
    class="vp-btn"
    :class="[`vp-btn--${variant}`, { 'vp-btn--disabled': disabled }]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.vp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.vp-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.vp-btn--primary {
  background: #2563eb;
  color: #fff;
}

.vp-btn--secondary {
  background: #f1f5f9;
  color: #0f172a;
}

.vp-btn--danger {
  background: #dc2626;
  color: #fff;
}

.vp-btn--disabled,
.vp-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
