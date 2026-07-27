import type { RequestHandler } from './$types';
import * as vehicleService from '$server/services/vehicleService';
import { vehicleSchema } from '$lib/domain/vehicle';
import { jsonResponse, parseBody, withRouteErrorHandling } from '$server/utils/route-handler';

export const GET: RequestHandler = async (event) => {
  return withRouteErrorHandling('Vehicles GET error:', async () => {
    const locale = event.cookies.get('PARAGLIDE_LOCALE') ?? 'en';
    const result = await vehicleService.getAllVehicles(event.locals.user?.id, locale);
    return jsonResponse(result);
  });
};

export const POST: RequestHandler = async (event) => {
  return withRouteErrorHandling('Vehicles POST error:', async () => {
    const parsed = await parseBody(event, vehicleSchema);
    const { id: _, ...body } = parsed;
    const result = await vehicleService.addVehicle(
      body,
      event.locals.user?.id as string,
      event.locals.user?.username as string
    );
    return jsonResponse(result, undefined, { status: 201 });
  });
};

export const PUT: RequestHandler = async (event) => {
  return withRouteErrorHandling('Vehicles PUT error:', async () => {
    const parsed = await parseBody(event, vehicleSchema);
    const result = await vehicleService.updateVehicle(
      parsed.id!,
      parsed,
      event.locals.user?.username,
      event.locals.user?.id
    );
    return jsonResponse(result);
  });
};
