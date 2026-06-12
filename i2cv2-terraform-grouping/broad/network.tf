# network.tf
# VPC, subnets, route tables, NAT/Internet gateways, transit gateway, VPC peering, NACLs, VPC endpoints, network interfaces, Direct Connect
#
# Resource types in this file:
#   - aws_customer_gateway
#   - aws_dx_gateway
#   - aws_ec2_managed_prefix_list
#   - aws_ec2_network_insights_analysis
#   - aws_ec2_network_insights_path
#   - aws_ec2_transit_gateway
#   - aws_ec2_transit_gateway_connect_peer
#   - aws_ec2_transit_gateway_multicast_domain
#   - aws_ec2_transit_gateway_policy_table
#   - aws_ec2_transit_gateway_route_table
#   - aws_ec2_transit_gateway_route_table_propagation
#   - aws_ec2_transit_gateway_vpc_attachment
#   - aws_eip
#   - aws_flow_log
#   - aws_internet_gateway
#   - aws_nat_gateway
#   - aws_network_acl
#   - aws_network_interface
#   - aws_route53_health_check
#   - aws_route53_resolver_endpoint
#   - aws_route53_resolver_firewall_domain_list
#   - aws_route53_resolver_firewall_rule_group
#   - aws_route53_resolver_firewall_rule_group_association
#   - aws_route53_resolver_query_log_config
#   - aws_route53_resolver_rule
#   - aws_route53_zone
#   - aws_route53recoverycontrolconfig_cluster
#   - aws_route_table
#   - aws_subnet
#   - aws_vpc
#   - aws_vpc_dhcp_options
#   - aws_vpc_endpoint
#   - aws_vpc_ipam
#   - aws_vpc_ipam_pool
#   - aws_vpc_ipam_resource_discovery
#   - aws_vpc_ipam_scope
#   - aws_vpc_peering_connection
#   - aws_vpc_security_group_ingress_rule
#   - aws_vpclattice_service
#   - aws_vpclattice_service_network
#   - aws_vpclattice_target_group
#   - aws_vpn_connection
#   - aws_vpn_gateway
#
# Total: 43 resource type(s)
