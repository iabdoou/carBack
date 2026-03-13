import { Controller, Get, Query } from '@nestjs/common';
import { Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@Controller('api/v1/vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all public vehicles' })
  @ApiQuery({ name: 'section', required: false })
  @ApiQuery({ name: 'brand', required: false })
  @ApiResponse({ status: 200, description: 'List of vehicles' })
  async findAll(
    @Query('section') section?: string,
    @Query('brand') brand?: string,
  ) {
    return this.vehiclesService.findAll({
      section,
      brand,
      status: 'ACTIVE',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle by ID' })
  @ApiResponse({ status: 200, description: 'Vehicle found' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async findById(@Param('id') id: string) {
    return this.vehiclesService.findById(id);
  }
}
