import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@Controller('api/v1/vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all public vehicles' })
  @ApiQuery({ name: 'brand', required: false })
  @ApiQuery({ name: 'mode', required: false, enum: ['IN_STOCK', 'ON_ORDER', 'IN_TRANSIT'] })
  @ApiQuery({ name: 'year_min', required: false })
  @ApiResponse({ status: 200, description: 'List of vehicles' })
  async findAll(
    @Query('brand') brand?: string,
    @Query('mode') mode?: string,
    @Query('year_min') yearMin?: string,
  ) {
    return this.vehiclesService.findAll({ brand, mode, yearMin });
  }

  @Get('filters/options')
  @ApiOperation({ summary: 'Get available filter values (brands, years)' })
  async getFilterOptions() {
    return this.vehiclesService.getFilterOptions();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle by ID' })
  @ApiResponse({ status: 200, description: 'Vehicle found' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.findById(id);
  }
}
