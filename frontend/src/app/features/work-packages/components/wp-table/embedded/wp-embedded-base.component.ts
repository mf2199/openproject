import { AfterViewInit, ChangeDetectorRef, Directive, Input, SimpleChanges } from '@angular/core';
import { WorkPackageStatesInitializationService } from '../../wp-list/wp-states-initialization.service';
import {
  WorkPackageTableConfiguration,
  WorkPackageTableConfigurationObject
} from 'core-app/features/work-packages/components/wp-table/wp-table-configuration';
import { LoadingIndicatorService } from 'core-app/core/loading-indicator/loading-indicator.service';
import { UrlParamsHelperService } from 'core-app/features/work-packages/components/wp-query/url-params-helper';
import { I18nService } from "core-app/core/i18n/i18n.service";
import { IsolatedQuerySpace } from "core-app/features/work-packages/directives/query-space/isolated-query-space";
import { WorkPackagesViewBase } from "core-app/features/work-packages/routing/wp-view-base/work-packages-view.base";
import { QueryResource } from "core-app/features/hal/resources/query-resource";
import { InjectField } from "core-app/shared/helpers/angular/inject-field.decorator";
import { APIV3Service } from "core-app/core/apiv3/api-v3.service";
import { CurrentProjectService } from "core-app/core/current-project/current-project.service";

@Directive()
export abstract class WorkPackageEmbeddedBaseComponent extends WorkPackagesViewBase implements AfterViewInit {
  @Input('configuration') protected providedConfiguration:WorkPackageTableConfigurationObject;
  @Input() public uniqueEmbeddedTableName = `embedded-table-${Date.now()}`;
  @Input() public initialLoadingIndicator = true;

  public renderTable = false;
  public showTablePagination = false;
  public configuration:WorkPackageTableConfiguration;
  public error:string|null = null;

  protected initialized = false;

  @InjectField() apiV3Service:APIV3Service;
  @InjectField() querySpace:IsolatedQuerySpace;
  @InjectField() I18n!:I18nService;
  @InjectField() urlParamsHelper:UrlParamsHelperService;
  @InjectField() loadingIndicatorService:LoadingIndicatorService;
  @InjectField() wpStatesInitialization:WorkPackageStatesInitializationService;
  @InjectField() currentProject:CurrentProjectService;
  @InjectField() cdRef:ChangeDetectorRef;

  ngOnInit() {
    this.configuration = new WorkPackageTableConfiguration(this.providedConfiguration);
    // Set embedded status in configuration
    this.configuration.isEmbedded = true;
    this.initialized = true;

    super.ngOnInit();
  }

  ngAfterViewInit():void {
    // Load initially
    this.loadQuery(true, false);
  }

  ngOnChanges(changes:SimpleChanges) {
    if (this.initialized && (changes.queryId || changes.queryProps)) {
      this.loadQuery(this.initialLoadingIndicator, false);
    }
  }

  public get projectIdentifier() {
    if (this.configuration.projectContext) {
      return this.currentProject.identifier || undefined;
    } else {
      return this.configuration.projectIdentifier || undefined;
    }
  }

  public buildQueryProps() {
    const query = this.querySpace.query.value!;
    this.wpStatesInitialization.applyToQuery(query);

    return this.urlParamsHelper.buildV3GetQueryFromQueryResource(query);
  }

  public buildUrlParams() {
    const query = this.querySpace.query.value!;
    this.wpStatesInitialization.applyToQuery(query);

    return this.urlParamsHelper.encodeQueryJsonParams(query);
  }

  protected setLoaded() {
    this.renderTable = this.configuration.tableVisible;
    this.cdRef.detectChanges();
  }

  public refresh(visible = true, firstPage = false):Promise<any> {
    const query = this.querySpace.query.value!;
    const pagination = this.wpTablePagination.paginationObject;

    if (firstPage) {
      pagination.offset = 1;
    }

    const params = this.urlParamsHelper.buildV3GetQueryFromQueryResource(query, pagination);
    const promise =
      this
        .wpListService
        .loadQueryFromExisting(query, params, this.queryProjectScope)
        .toPromise()
        .then((query) => this.wpStatesInitialization.updateQuerySpace(query, query.results));

    if (visible) {
      this.loadingIndicator = promise;
    }
    return promise;
  }

  public get isInitialized() {
    return !!this.configuration;
  }

  public set loadingIndicator(promise:Promise<any>) {
    if (this.configuration.tableVisible) {
      this.loadingIndicatorService
        .indicator(this.uniqueEmbeddedTableName)
        .promise = promise;
    }
  }

  public abstract loadQuery(visible:boolean, firstPage:boolean):Promise<any>;

  protected get queryProjectScope() {
    if (!this.configuration.projectContext) {
      return undefined;
    } else {
      return this.projectIdentifier;
    }
  }

  protected initializeStates(query:QueryResource) {
    this.wpStatesInitialization.clearStates();
    this.wpStatesInitialization.initializeFromQuery(query, query.results);
    this.wpStatesInitialization.updateQuerySpace(query, query.results);
  }
}
