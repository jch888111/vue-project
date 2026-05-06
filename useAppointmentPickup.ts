import { reactive } from 'vue';
import dayjs from 'dayjs';
import { t } from '@/i18n';
import { merge } from 'lodash-es';

/**
 * 预约上门揽收时间配置 Hook
 */
export function useAppointmentPickup(formData: any, changeValue: (key: string) => void) {
  // 发货时段校验错误提示
  const pickupTimeSlotErrors = reactive<Record<string, string[]>>({
    normal_jit: [],
    warehouse_urgent: [],
    warehouse: [],
  });

  // 初始化预约上门揽收的time_slots
  const initPickupTimeSlots = (key: string) => {
    if (!formData[key].appointment_pickup) {
      formData[key].appointment_pickup = {
        enable: false,
        time_slots: [
          {
            start_time: '',
            end_time: '',
            pickup_date_type: 1,
            pickup_time: '',
          },
        ],
      };
    }

    // 初始化错误提示数组
    if (!pickupTimeSlotErrors[key]?.length) {
      pickupTimeSlotErrors[key] = [];
    }
  };

  // 将时间字符串转换为dayjs对象（用于比较）
  const parseTime = (timeStr: string) => {
    return dayjs(timeStr, 'HH:mm:ss');
  };

  // 检查当前时段是否为空（开始或结束任一未填）
  const checkTimeSlotEmpty = (key: string, currentIndex: number): boolean => {
    const slot = formData[key].appointment_pickup.time_slots[currentIndex];
    if (!slot) {
      return true;
    }
    return !slot.start_time || !slot.end_time;
  };

  // 检查时段是否重叠
  const checkTimeSlotOverlap = (key: string, currentIndex: number): boolean => {
    const currentSlot = formData[key].appointment_pickup.time_slots[currentIndex];
    const currentStart = parseTime(currentSlot.start_time);
    const currentEnd = parseTime(currentSlot.end_time);

    return formData[key].appointment_pickup.time_slots.some((slot: any, index: number) => {
      if (index === currentIndex || !slot.start_time || !slot.end_time) {
        return false;
      }

      const slotStart = parseTime(slot.start_time);
      const slotEnd = parseTime(slot.end_time);

      // 判断是否重叠：当前时段与另一个时段有交集
      return !(
        currentEnd.isBefore(slotStart) ||
        currentEnd.isSame(slotStart) ||
        currentStart.isAfter(slotEnd) ||
        currentStart.isSame(slotEnd)
      );
    });
  };

  // 校验发货时段
  const validatePickupTimeSlot = (key: string, slotIndex: number) => {
    const errors = pickupTimeSlotErrors[key] || [];
    errors[slotIndex] = '';

    // 校验时段不能为空
    const hasEmpty = checkTimeSlotEmpty(key, slotIndex);
    if (hasEmpty) {
      errors[slotIndex] = t('preDelivery.timeSlotRequired');
      pickupTimeSlotErrors[key] = errors;
      return;
    }

    // 校验时段不能重叠
    const hasOverlap = checkTimeSlotOverlap(key, slotIndex);
    if (hasOverlap) {
      errors[slotIndex] = t('preDelivery.timeSlotOverlap');
      pickupTimeSlotErrors[key] = errors;
      return;
    }

    pickupTimeSlotErrors[key] = errors;
  };

  // 处理时间范围变化
  const handleTimeRangeChange = (timeRange: any, key: string, slotIndex: number) => {
    if (!timeRange || !Array.isArray(timeRange) || timeRange.length !== 2) {
      return;
    }

    const [startTimeStr, endTimeStr] = timeRange;

    // 处理开始时间：强制设置为00秒
    if (startTimeStr) {
      const startTimeObj =
        typeof startTimeStr === 'string' ? dayjs(startTimeStr, 'HH:mm:ss') : dayjs(startTimeStr);
      const normalizedStartTime = startTimeObj.second(0);
      formData[key].appointment_pickup.time_slots[slotIndex].start_time =
        normalizedStartTime.format('HH:mm:ss');
    }

    // 处理结束时间：强制设置为59秒
    if (endTimeStr) {
      const endTimeObj =
        typeof endTimeStr === 'string' ? dayjs(endTimeStr, 'HH:mm:ss') : dayjs(endTimeStr);
      const normalizedEndTime = endTimeObj.second(59);
      formData[key].appointment_pickup.time_slots[slotIndex].end_time =
        normalizedEndTime.format('HH:mm:ss');
    }

    validatePickupTimeSlot(key, slotIndex);

    changeValue(key);
  };

  // 获取禁用时间配置
  const getDisabledTime = (_current: any, type: any, key: string, slotIndex: number) => {
    const disabledHours: number[] = [];
    let prevEndHour = -1;
    let prevEndMinute = -1;

    // 如果是开始时间或结束时间，且不是第一个时段，需要禁用上一个时段结束时间之前的时间
    if (slotIndex > 0) {
      try {
        // 获取上一个时段的结束时间
        const prevSlot = formData[key].appointment_pickup.time_slots[slotIndex - 1];
        if (prevSlot?.end_time) {
          const prevEndTime = parseTime(prevSlot.end_time);
          prevEndHour = prevEndTime.hour();
          prevEndMinute = prevEndTime.minute();

          // 禁用所有小于上一个时段结束小时的小时
          for (let hour = 0; hour < prevEndHour; hour++) {
            disabledHours.push(hour);
          }
        }
      } catch (error) {
        // 如果出现任何错误，只返回秒数限制
        console.warn('getDisabledTime error:', error);
      }
    }

    return {
      disabledHours: () => disabledHours,
      disabledMinutes: (selectedHour: number) => {
        const disabledMinutes: number[] = [];

        // 如果是开始时间或结束时间，且不是第一个时段，且当前选择的小时等于上一个时段的结束小时
        if (slotIndex > 0 && selectedHour === prevEndHour && prevEndMinute >= 0) {
          // 禁用小于等于上一个时段结束分钟的所有分钟
          for (let minute = 0; minute <= prevEndMinute; minute++) {
            disabledMinutes.push(minute);
          }
        }

        return disabledMinutes;
      },
      disabledSeconds: () =>
        type === 'start'
          ? Array.from({ length: 59 }, (_, i) => i + 1) // 开始时间：禁用1-59秒，只能选00
          : Array.from({ length: 59 }, (_, i) => i), // 结束时间：禁用0-58秒，只能选59
    };
  };

  // 添加配置项
  const addPickupTimeSlot = (key: string) => {
    formData[key].appointment_pickup.time_slots.push({
      start_time: '',
      end_time: '',
      pickup_date_type: 1,
      pickup_time: '',
    });
    pickupTimeSlotErrors[key].push('');
    changeValue(key);
  };

  // 删除配置项
  const removePickupTimeSlot = (key: string, slotIndex: number) => {
    formData[key].appointment_pickup.time_slots.splice(slotIndex, 1);
    pickupTimeSlotErrors[key].splice(slotIndex, 1);
    changeValue(key);
  };

  // 校验预约上门揽收
  const validateAppointmentPickup = (key: string): boolean => {
    const currentItem = formData[key];
    if (!currentItem.appointment_pickup?.enable) {
      return true;
    }

    // 清空错误提示
    if (pickupTimeSlotErrors[key]) {
      pickupTimeSlotErrors[key] = pickupTimeSlotErrors[key].map(() => '');
    }

    // 校验所有时段
    let hasError = false;
    currentItem.appointment_pickup.time_slots.forEach((_: any, index: number) => {
      validatePickupTimeSlot(key, index);
      if (pickupTimeSlotErrors[key]?.[index]) {
        hasError = true;
      }
    });

    return !hasError;
  };

  // 处理数据回填
  const handleDataBackfill = (key: string, parsedData: any) => {
    // 确保预约上门揽收数据结构完整
    if (!parsedData.appointment_pickup) {
      parsedData.appointment_pickup = {
        enable: false,
        time_slots: [
          {
            start_time: '',
            end_time: '',
            pickup_date_type: 1,
            pickup_time: '',
          },
        ],
      };
    }

    // 确保time_slots至少有一个
    if (
      !parsedData.appointment_pickup.time_slots ||
      parsedData.appointment_pickup.time_slots.length === 0
    ) {
      parsedData.appointment_pickup.time_slots = [
        {
          start_time: '',
          end_time: '',
          pickup_date_type: 1,
          pickup_time: '',
        },
      ];
    }

    merge(formData[key], parsedData);

    // 初始化错误提示数组
    initPickupTimeSlots(key);
  };

  return {
    pickupTimeSlotErrors,
    initPickupTimeSlots,
    handleTimeRangeChange,
    getDisabledTime,
    addPickupTimeSlot,
    removePickupTimeSlot,
    validateAppointmentPickup,
    handleDataBackfill,
  };
}
