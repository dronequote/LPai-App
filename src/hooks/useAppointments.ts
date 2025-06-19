import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentService } from '../services/appointmentService';

export const useAppointments = (locationId: string, params?: any) => {
  return useQuery({
    queryKey: ['appointments', locationId, params],
    queryFn: () => appointmentService.list(locationId, params),
    enabled: !!locationId,
  });
};

export const useAppointmentDetails = (appointmentId: string) => {
  return useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => appointmentService.getDetails(appointmentId),
    enabled: !!appointmentId,
  });
};

export const useUpdateAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data, locationId }: any) => 
      appointmentService.update(id, data, locationId),
    onSuccess: () => {
      // This will refetch all appointment queries
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
};

export const useDeleteAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => appointmentService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
};